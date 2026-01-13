/**
 * Example Usage: Consolidated Invoice Service
 *
 * This file demonstrates practical usage patterns for the consolidated
 * invoice service, showing real-world scenarios and best practices.
 */

import {
  createConsolidatedInvoice,
  validateSubAccounts,
  updateConsolidatedInvoice,
  renderConsolidatedInvoiceText,
  type ConsolidatedInvoiceInput,
} from './consolidatedInvoiceService'
import type { Contact, InvoiceLineItem } from '../types'

// =============================================================================
// Example 1: Basic Consolidated Invoice Creation
// =============================================================================

/**
 * Example: Create a consolidated invoice for a parent company with
 * multiple divisions/locations
 */
async function example1_BasicConsolidatedInvoice() {
  console.log('=== Example 1: Basic Consolidated Invoice ===\n')

  // Mock contact retrieval function
  const getContact = async (id: string): Promise<Contact | null> => {
    const contacts: Record<string, Contact> = {
      'parent-corp': {
        id: 'parent-corp',
        companyId: 'company-1',
        type: 'customer',
        name: 'GlobalTech Corporation',
        email: 'billing@globaltech.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'division-ny': {
        id: 'division-ny',
        companyId: 'company-1',
        type: 'customer',
        name: 'GlobalTech New York',
        email: 'ny@globaltech.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentContactId: 'parent-corp',
      } as Contact,
      'division-ca': {
        id: 'division-ca',
        companyId: 'company-1',
        type: 'customer',
        name: 'GlobalTech California',
        email: 'ca@globaltech.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentContactId: 'parent-corp',
      } as Contact,
    }
    return contacts[id] || null
  }

  // Mock invoice number generator
  let counter = 5000
  const generateInvoiceNumber = async () => `INV-${String(counter++).padStart(6, '0')}`

  // Define line items for New York division
  const nyLineItems: InvoiceLineItem[] = [
    {
      id: 'line-1',
      description: 'Web Development Services',
      quantity: 40,
      rate: 125,
      amount: 5000,
      accountId: 'acc-services',
      taxable: true,
    },
    {
      id: 'line-2',
      description: 'Server Hosting (Monthly)',
      quantity: 1,
      rate: 500,
      amount: 500,
      accountId: 'acc-hosting',
      taxable: true,
    },
  ]

  // Define line items for California division
  const caLineItems: InvoiceLineItem[] = [
    {
      id: 'line-3',
      description: 'UI/UX Design Services',
      quantity: 30,
      rate: 150,
      amount: 4500,
      accountId: 'acc-services',
      taxable: true,
    },
    {
      id: 'line-4',
      description: 'Mobile App Development',
      quantity: 60,
      rate: 140,
      amount: 8400,
      accountId: 'acc-services',
      taxable: true,
    },
  ]

  // Create the consolidated invoice
  const input: ConsolidatedInvoiceInput = {
    parentAccountId: 'parent-corp',
    companyId: 'company-1',
    date: new Date('2024-01-31'),
    dueDate: new Date('2024-03-01'), // 30 days
    displayMode: 'itemized',
    notes: 'Thank you for your business. Payment is due within 30 days.',
    terms: 'Net 30',
    subAccountItems: new Map([
      ['division-ny', nyLineItems],
      ['division-ca', caLineItems],
    ]),
    taxRate: 0.085, // 8.5% sales tax
  }

  const result = await createConsolidatedInvoice(input, getContact, generateInvoiceNumber)

  if (result.success) {
    console.log('✓ Invoice created successfully!')
    console.log(`  Invoice Number: ${result.data.invoiceNumber}`)
    console.log(`  Customer: ${result.data.customerId}`)
    console.log(`  Subtotal: $${result.data.subtotal.toFixed(2)}`)
    console.log(`  Tax: $${result.data.taxAmount.toFixed(2)}`)
    console.log(`  Total: $${result.data.total.toFixed(2)}`)
    console.log(`  Sections: ${result.data.sections?.length || 0}`)
    console.log('\n' + renderConsolidatedInvoiceText(result.data))
  } else {
    console.error('✗ Failed to create invoice:', result.error.message)
  }
}

// =============================================================================
// Example 2: Validation Before Invoice Creation
// =============================================================================

/**
 * Example: Validate sub-accounts before creating an invoice
 * to ensure data integrity
 */
async function example2_ValidateBeforeCreation() {
  console.log('\n=== Example 2: Validation Before Creation ===\n')

  const getContact = async (id: string): Promise<Contact | null> => {
    const contacts: Record<string, Contact> = {
      'parent-hotel': {
        id: 'parent-hotel',
        companyId: 'company-1',
        type: 'customer',
        name: 'Luxury Hotels Group',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'hotel-miami': {
        id: 'hotel-miami',
        companyId: 'company-1',
        type: 'customer',
        name: 'Luxury Hotels - Miami',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentContactId: 'parent-hotel',
      } as Contact,
      'hotel-vegas': {
        id: 'hotel-vegas',
        companyId: 'company-1',
        type: 'customer',
        name: 'Luxury Hotels - Las Vegas',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentContactId: 'parent-hotel',
      } as Contact,
      'independent-hotel': {
        id: 'independent-hotel',
        companyId: 'company-1',
        type: 'customer',
        name: 'Independent Boutique Hotel',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentContactId: 'different-parent',
      } as Contact,
    }
    return contacts[id] || null
  }

  // Attempt to validate with one invalid sub-account
  const validation = await validateSubAccounts(
    'parent-hotel',
    ['hotel-miami', 'hotel-vegas', 'independent-hotel'],
    getContact
  )

  console.log('Validation Results:')
  console.log(`  Valid: ${validation.isValid}`)
  console.log(`  Valid Sub-accounts: ${validation.validSubAccountIds.join(', ')}`)
  console.log(`  Invalid Sub-accounts: ${validation.invalidSubAccountIds.join(', ')}`)

  if (validation.errors.length > 0) {
    console.log('\nErrors:')
    validation.errors.forEach((error) => console.log(`  - ${error}`))
  }

  if (validation.warnings.length > 0) {
    console.log('\nWarnings:')
    validation.warnings.forEach((warning) => console.log(`  - ${warning}`))
  }

  // Proceed only with valid sub-accounts
  if (!validation.isValid) {
    console.log('\n⚠ Proceeding with only valid sub-accounts...')
    console.log(`  Using: ${validation.validSubAccountIds.join(', ')}`)
  }
}

// =============================================================================
// Example 3: Different Display Modes
// =============================================================================

/**
 * Example: Create consolidated invoices with different display modes
 * to suit different client preferences
 */
async function example3_DisplayModes() {
  console.log('\n=== Example 3: Display Modes ===\n')

  const getContact = async (id: string): Promise<Contact | null> => {
    return {
      id,
      companyId: 'company-1',
      type: 'customer',
      name: `Account ${id}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentContactId: 'parent',
    } as Contact
  }

  let counter = 6000
  const generateInvoiceNumber = async () => `INV-${String(counter++).padStart(6, '0')}`

  const lineItems: InvoiceLineItem[] = [
    {
      id: '1',
      description: 'Consulting',
      quantity: 10,
      rate: 200,
      amount: 2000,
      accountId: 'acc-1',
      taxable: true,
    },
  ]

  // Mode 1: Itemized (shows all line items)
  console.log('1. ITEMIZED MODE - Shows all line items in detail')
  const itemizedInput: ConsolidatedInvoiceInput = {
    parentAccountId: 'parent',
    companyId: 'company-1',
    date: new Date(),
    dueDate: new Date(),
    displayMode: 'itemized',
    subAccountItems: new Map([['sub-1', lineItems]]),
    taxRate: 0.08,
  }

  const itemized = await createConsolidatedInvoice(
    itemizedInput,
    getContact,
    generateInvoiceNumber
  )
  if (itemized.success) {
    console.log('   Best for: Clients who want detailed breakdowns\n')
  }

  // Mode 2: Totaled (shows only subtotals)
  console.log('2. TOTALED MODE - Shows only section subtotals')
  const totaledInput: ConsolidatedInvoiceInput = {
    ...itemizedInput,
    displayMode: 'totaled',
  }

  const totaled = await createConsolidatedInvoice(
    totaledInput,
    getContact,
    generateInvoiceNumber
  )
  if (totaled.success) {
    console.log('   Best for: Executive summaries, high-level views\n')
  }

  // Mode 3: Hybrid (totals with expandable detail)
  console.log('3. HYBRID MODE - Totals with option to view details')
  const hybridInput: ConsolidatedInvoiceInput = {
    ...itemizedInput,
    displayMode: 'hybrid',
  }

  const hybrid = await createConsolidatedInvoice(
    hybridInput,
    getContact,
    generateInvoiceNumber
  )
  if (hybrid.success) {
    console.log('   Best for: Interactive PDFs, web portals\n')
  }
}

// =============================================================================
// Example 4: Updating a Consolidated Invoice
// =============================================================================

/**
 * Example: Update an existing consolidated invoice by adding
 * or modifying sub-account sections
 */
async function example4_UpdatingInvoice() {
  console.log('\n=== Example 4: Updating Consolidated Invoice ===\n')

  const getContact = async (id: string): Promise<Contact | null> => {
    return {
      id,
      companyId: 'company-1',
      type: 'customer',
      name: `Location ${id}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentContactId: 'parent',
    } as Contact
  }

  let counter = 7000
  const generateInvoiceNumber = async () => `INV-${String(counter++).padStart(6, '0')}`

  // Create initial invoice with one location
  const initialInput: ConsolidatedInvoiceInput = {
    parentAccountId: 'parent',
    companyId: 'company-1',
    date: new Date(),
    dueDate: new Date(),
    displayMode: 'itemized',
    subAccountItems: new Map([
      [
        'location-1',
        [
          {
            id: '1',
            description: 'Initial Service',
            quantity: 5,
            rate: 100,
            amount: 500,
            accountId: 'acc-1',
            taxable: true,
          },
        ],
      ],
    ]),
    taxRate: 0.08,
  }

  const createResult = await createConsolidatedInvoice(
    initialInput,
    getContact,
    generateInvoiceNumber
  )

  if (!createResult.success) {
    console.error('Failed to create initial invoice')
    return
  }

  console.log('Initial Invoice:')
  console.log(`  Sections: ${createResult.data.sections?.length}`)
  console.log(`  Total: $${createResult.data.total.toFixed(2)}\n`)

  // Add additional location
  const additionalItems = new Map([
    [
      'location-2',
      [
        {
          id: '2',
          description: 'Additional Service',
          quantity: 3,
          rate: 150,
          amount: 450,
          accountId: 'acc-1',
          taxable: true,
        },
      ],
    ],
  ])

  const updateResult = await updateConsolidatedInvoice(
    createResult.data,
    additionalItems,
    0.08,
    getContact
  )

  if (updateResult.success) {
    console.log('Updated Invoice:')
    console.log(`  Sections: ${updateResult.data.sections?.length}`)
    console.log(`  Total: $${updateResult.data.total.toFixed(2)}`)
    console.log(`  Change: +$${(updateResult.data.total - createResult.data.total).toFixed(2)}`)
  }
}

// =============================================================================
// Example 5: Real-world Scenario - Multi-Location Retail Chain
// =============================================================================

/**
 * Example: Comprehensive real-world scenario for a retail chain
 * with multiple store locations
 */
async function example5_RetailChainScenario() {
  console.log('\n=== Example 5: Retail Chain Scenario ===\n')

  // Simulate a retail chain with 5 store locations
  const stores = [
    { id: 'store-001', name: 'Downtown Store', hours: 160, rate: 85 },
    { id: 'store-002', name: 'Mall Location', hours: 180, rate: 85 },
    { id: 'store-003', name: 'Airport Location', hours: 200, rate: 95 },
    { id: 'store-004', name: 'Outlet Store', hours: 120, rate: 75 },
    { id: 'store-005', name: 'Warehouse', hours: 140, rate: 65 },
  ]

  const getContact = async (id: string): Promise<Contact | null> => {
    if (id === 'retail-headquarters') {
      return {
        id: 'retail-headquarters',
        companyId: 'company-1',
        type: 'customer',
        name: 'Fashion Retail Group HQ',
        email: 'billing@fashionretail.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }

    const store = stores.find((s) => s.id === id)
    if (store) {
      return {
        id: store.id,
        companyId: 'company-1',
        type: 'customer',
        name: store.name,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentContactId: 'retail-headquarters',
      } as Contact
    }

    return null
  }

  let counter = 8000
  const generateInvoiceNumber = async () => `INV-${String(counter++).padStart(6, '0')}`

  // Create line items for each store
  const subAccountItems = new Map<string, InvoiceLineItem[]>()

  stores.forEach((store) => {
    const items: InvoiceLineItem[] = [
      {
        id: `${store.id}-security`,
        description: 'Security Services',
        quantity: store.hours,
        rate: store.rate,
        amount: store.hours * store.rate,
        accountId: 'acc-security',
        taxable: false, // Services often exempt
      },
      {
        id: `${store.id}-supplies`,
        description: 'Monthly Supplies',
        quantity: 1,
        rate: 350,
        amount: 350,
        accountId: 'acc-supplies',
        taxable: true,
      },
    ]
    subAccountItems.set(store.id, items)
  })

  // Create the consolidated invoice
  const input: ConsolidatedInvoiceInput = {
    parentAccountId: 'retail-headquarters',
    companyId: 'company-1',
    date: new Date('2024-01-31'),
    dueDate: new Date('2024-02-29'),
    displayMode: 'hybrid',
    notes:
      'Monthly consolidated invoice for all retail locations. Security hours billed at location-specific rates. Contact us with any questions.',
    terms: 'Net 30. 2% discount if paid within 10 days.',
    subAccountItems,
    taxRate: 0.0825, // 8.25%
  }

  console.log('Creating invoice for Fashion Retail Group...')
  console.log(`  Locations: ${stores.length}`)
  console.log(`  Period: January 2024\n`)

  const result = await createConsolidatedInvoice(input, getContact, generateInvoiceNumber)

  if (result.success) {
    const invoice = result.data

    console.log('✓ Invoice Created Successfully!')
    console.log(`  Invoice Number: ${invoice.invoiceNumber}`)
    console.log(`  Date: ${invoice.date.toLocaleDateString()}`)
    console.log(`  Due Date: ${invoice.dueDate.toLocaleDateString()}`)
    console.log(`  Display Mode: ${invoice.displayMode}\n`)

    console.log('Breakdown by Location:')
    invoice.sections?.forEach((section, index) => {
      console.log(`  ${index + 1}. ${section.subaccountName}`)
      console.log(`     Items: ${section.lineItems.length}`)
      console.log(`     Subtotal: $${section.subtotal.toFixed(2)}`)
      console.log(`     Tax: $${section.taxAmount.toFixed(2)}`)
      console.log(`     Total: $${section.total.toFixed(2)}`)
    })

    console.log('\nGrand Totals:')
    console.log(`  Subtotal: $${invoice.subtotal.toFixed(2)}`)
    console.log(`  Tax: $${invoice.taxAmount.toFixed(2)}`)
    console.log(`  Total Due: $${invoice.total.toFixed(2)}`)

    // Calculate early payment discount
    const earlyPaymentDiscount = invoice.total * 0.02
    console.log(
      `  Early Payment (10 days): $${(invoice.total - earlyPaymentDiscount).toFixed(2)} (save $${earlyPaymentDiscount.toFixed(2)})`
    )

    console.log('\n--- Text Representation ---')
    console.log(renderConsolidatedInvoiceText(invoice))
  } else {
    console.error('✗ Failed to create invoice:', result.error.message)
  }
}

// =============================================================================
// Run Examples
// =============================================================================

/**
 * Execute all examples
 * Uncomment individual examples to run them
 */
async function runExamples() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║    Consolidated Invoice Service - Example Usage               ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  try {
    // Run all examples
    await example1_BasicConsolidatedInvoice()
    await example2_ValidateBeforeCreation()
    await example3_DisplayModes()
    await example4_UpdatingInvoice()
    await example5_RetailChainScenario()

    console.log('\n✓ All examples completed successfully!')
  } catch (error) {
    console.error('\n✗ Example failed:', error)
  }
}

// Execute if run directly
if (require.main === module) {
  runExamples()
}

export {
  example1_BasicConsolidatedInvoice,
  example2_ValidateBeforeCreation,
  example3_DisplayModes,
  example4_UpdatingInvoice,
  example5_RetailChainScenario,
}
