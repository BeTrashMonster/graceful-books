# Consolidated Invoice Service

## Overview

The Consolidated Invoice Service provides functionality for creating and managing invoices that combine billing across multiple sub-accounts under a single parent account. This is particularly useful for:

- **Multi-location businesses**: Bill a corporate headquarters for all branch locations
- **Franchise operations**: Consolidate billing for multiple franchise locations
- **Department-based billing**: Combine charges from different departments
- **Client subsidiaries**: Bill a parent company for services to their subsidiaries

## Key Features

1. **Multi-Account Consolidation**: Combine line items from multiple sub-accounts into a single invoice
2. **Hierarchical Validation**: Ensures all sub-accounts belong to the specified parent
3. **Flexible Display Modes**:
   - **Itemized**: Shows all line items for each sub-account
   - **Totaled**: Shows only subtotals per sub-account
   - **Hybrid**: Shows totals with expandable detail
4. **Automatic Calculations**: Subtotals, taxes, and grand totals computed automatically
5. **Update Support**: Modify existing consolidated invoices by adding/updating sections
6. **Format Conversion**: Convert individual invoices to consolidated format

## Architecture

### Type Extensions

The service extends the base `Invoice` interface with new fields:

```typescript
export interface Invoice {
  // ... existing fields ...

  // Consolidated invoice fields
  consolidationType: 'individual' | 'consolidated'
  parentAccountId?: string | null
  displayMode?: 'itemized' | 'totaled' | 'hybrid'
  sections?: InvoiceSubAccountSection[]
}

export interface InvoiceSubAccountSection {
  subaccountId: string
  subaccountName: string
  lineItems: InvoiceLineItem[]
  subtotal: number
  taxAmount: number
  total: number
}
```

### Service Functions

#### Core Functions

1. **`validateSubAccounts()`**
   - Validates parent-child relationships
   - Returns detailed validation results
   - Non-blocking warnings for extensibility

2. **`calculateSubtotals()`**
   - Computes totals for each sub-account section
   - Handles taxable vs non-taxable items
   - Aggregates grand totals

3. **`createConsolidatedInvoice()`**
   - Main function for creating consolidated invoices
   - Performs validation and calculation
   - Returns Result type for error handling

#### Utility Functions

4. **`updateConsolidatedInvoice()`**
   - Updates existing consolidated invoices
   - Adds new sections or modifies existing ones
   - Recalculates all totals

5. **`convertToConsolidated()`**
   - Converts individual invoices to consolidated format
   - Useful for data migration

6. **`renderConsolidatedInvoiceText()`**
   - Generates text representation of invoice
   - Respects display mode settings

7. **`renderConsolidatedPDF()`** _(Placeholder)_
   - Future PDF generation functionality
   - Will use jsPDF or similar library

## Usage Examples

### Basic Usage

```typescript
import {
  createConsolidatedInvoice,
  type ConsolidatedInvoiceInput,
} from './services/consolidatedInvoiceService'

// Define line items for each sub-account
const subAccountItems = new Map([
  ['sub-account-1', [
    {
      id: '1',
      description: 'Consulting Services',
      quantity: 40,
      rate: 150,
      amount: 6000,
      accountId: 'acc-services',
      taxable: true,
    }
  ]],
  ['sub-account-2', [
    {
      id: '2',
      description: 'Software License',
      quantity: 10,
      rate: 50,
      amount: 500,
      accountId: 'acc-software',
      taxable: true,
    }
  ]]
])

// Create the consolidated invoice
const input: ConsolidatedInvoiceInput = {
  parentAccountId: 'parent-account-id',
  companyId: 'your-company-id',
  date: new Date(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  displayMode: 'itemized',
  notes: 'Thank you for your business',
  terms: 'Net 30',
  subAccountItems,
  taxRate: 0.08, // 8% tax
}

const result = await createConsolidatedInvoice(
  input,
  getContactById,
  generateInvoiceNumber
)

if (result.success) {
  console.log('Invoice created:', result.data.invoiceNumber)
  console.log('Total:', result.data.total)
} else {
  console.error('Error:', result.error.message)
}
```

### Validation Before Creation

```typescript
import { validateSubAccounts } from './services/consolidatedInvoiceService'

const subAccountIds = ['sub-1', 'sub-2', 'sub-3']
const validation = await validateSubAccounts(
  'parent-id',
  subAccountIds,
  getContactById
)

if (!validation.isValid) {
  console.error('Validation failed:', validation.errors)
  console.log('Invalid accounts:', validation.invalidSubAccountIds)
} else {
  console.log('All accounts validated successfully')
  // Proceed with invoice creation
}
```

### Updating an Invoice

```typescript
import { updateConsolidatedInvoice } from './services/consolidatedInvoiceService'

// Add a new sub-account section
const newItems = new Map([
  ['sub-account-3', [
    {
      id: '3',
      description: 'Additional Service',
      quantity: 5,
      rate: 200,
      amount: 1000,
      accountId: 'acc-services',
      taxable: true,
    }
  ]]
])

const result = await updateConsolidatedInvoice(
  existingInvoice,
  newItems,
  0.08, // tax rate
  getContactById
)

if (result.success) {
  console.log('Invoice updated')
  console.log('New total:', result.data.total)
}
```

### Display Mode Examples

#### Itemized Mode
Shows all line items for complete transparency:
```
--- Acme East Division (sub-1) ---
  Consulting Services           40 × $150.00 = $6000.00
  Server Hosting                1 × $500.00 = $500.00

  Subtotal: $6500.00
  Tax: $520.00
  Total: $7020.00
```

#### Totaled Mode
Shows only summary totals for executive view:
```
--- Acme East Division (sub-1) ---
  Subtotal: $6500.00
  Tax: $520.00
  Total: $7020.00
```

#### Hybrid Mode
Shows totals with ability to expand for details (ideal for interactive PDFs):
```
--- Acme East Division (sub-1) ---
  Total: $7020.00 [+] Show Details

  [Expanded View]
  Consulting Services           40 × $150.00 = $6000.00
  Server Hosting                1 × $500.00 = $500.00
```

## Real-World Scenarios

### Scenario 1: Multi-Location Retail Chain

A retail chain with 5 store locations needs consolidated monthly billing:

```typescript
const stores = [
  { id: 'store-001', name: 'Downtown', hours: 160 },
  { id: 'store-002', name: 'Mall', hours: 180 },
  { id: 'store-003', name: 'Airport', hours: 200 },
]

const subAccountItems = new Map()
stores.forEach(store => {
  subAccountItems.set(store.id, [
    {
      id: `${store.id}-security`,
      description: 'Security Services',
      quantity: store.hours,
      rate: 85,
      amount: store.hours * 85,
      accountId: 'acc-security',
      taxable: false,
    }
  ])
})

// Create consolidated invoice for corporate HQ
```

### Scenario 2: Franchise Operations

A franchise management company bills franchisees through corporate:

```typescript
const franchises = ['franchise-atlanta', 'franchise-boston', 'franchise-chicago']

const input: ConsolidatedInvoiceInput = {
  parentAccountId: 'corporate-hq',
  displayMode: 'totaled', // Corporate prefers summary view
  // ... other fields
}
```

### Scenario 3: Department-Based Billing

A consulting firm bills clients by department:

```typescript
const departments = [
  'dept-engineering',
  'dept-design',
  'dept-marketing',
  'dept-sales'
]

const input: ConsolidatedInvoiceInput = {
  parentAccountId: 'client-corp',
  displayMode: 'itemized', // Show detailed breakdown
  // ... other fields
}
```

## Best Practices

### 1. Always Validate Before Creating

```typescript
// Good
const validation = await validateSubAccounts(parentId, subIds, getContact)
if (!validation.isValid) {
  // Handle errors
  return
}
const result = await createConsolidatedInvoice(...)

// Bad
const result = await createConsolidatedInvoice(...) // May fail unexpectedly
```

### 2. Use Appropriate Display Mode

- **Itemized**: When clients need full detail for approval/reconciliation
- **Totaled**: For executive summaries or high-level reporting
- **Hybrid**: For interactive systems where users can drill down

### 3. Handle Tax Rates Correctly

```typescript
// Specify tax rate as decimal
const taxRate = 0.0825 // 8.25%

// Mark items correctly
const lineItem = {
  // ...
  taxable: true, // or false for tax-exempt items
}
```

### 4. Provide Clear Notes and Terms

```typescript
const input: ConsolidatedInvoiceInput = {
  // ...
  notes: 'Monthly consolidated invoice for all locations. Questions? Contact billing@company.com',
  terms: 'Net 30. 2% discount if paid within 10 days.',
}
```

### 5. Use Meaningful Descriptions

```typescript
// Good
description: 'Consulting Services - January 2024 (40 hours @ $150/hr)'

// Less helpful
description: 'Services'
```

## Error Handling

The service uses the `Result<T>` type for error handling:

```typescript
const result = await createConsolidatedInvoice(...)

if (result.success) {
  // Access data
  const invoice = result.data
  console.log('Success:', invoice.invoiceNumber)
} else {
  // Handle error
  const error = result.error
  console.error('Failed:', error.message)

  // Log for debugging
  logger.error('Invoice creation failed', {
    parentId: input.parentAccountId,
    error: error.message,
  })
}
```

## Testing

Comprehensive test suite included at:
- `src/services/consolidatedInvoiceService.test.ts`

Run tests with:
```bash
npm test consolidatedInvoiceService
```

## Future Enhancements

### Planned Features

1. **PDF Generation**: Implement `renderConsolidatedPDF()` with professional layouts
2. **Email Integration**: Automatic sending of consolidated invoices
3. **Payment Allocation**: Track payments across sub-account sections
4. **Custom Templates**: Branded invoice templates per customer
5. **Multi-Currency**: Support for consolidated invoices in multiple currencies
6. **Approval Workflows**: Route consolidated invoices through approval chains
7. **Analytics**: Reporting on consolidated billing patterns

### Extensibility Points

The service is designed for extension:

- **Custom Validation**: Add business-specific validation rules
- **Calculation Hooks**: Insert custom logic into calculation pipeline
- **Rendering Adapters**: Implement custom output formats
- **Storage Integration**: Connect to any database/ORM

## Integration Points

### Required Dependencies

The service requires:

1. **Contact Service**: For retrieving customer/sub-account information
   ```typescript
   getContact: (id: string) => Promise<Contact | null>
   ```

2. **Invoice Numbering**: For generating unique invoice numbers
   ```typescript
   generateInvoiceNumber: () => Promise<string>
   ```

### Optional Integrations

- **Email Service**: For sending invoices
- **PDF Service**: For PDF generation (when implemented)
- **Payment Service**: For payment tracking
- **Notification Service**: For alerts on invoice creation/updates

## Performance Considerations

- **Batch Processing**: When creating many consolidated invoices, consider batching
- **Caching**: Cache contact lookups during validation
- **Async Operations**: All functions are async for non-blocking execution
- **Memory**: Large invoices (100+ line items) may require streaming for PDF generation

## Support

For questions or issues:

1. Review the examples in `src/services/consolidatedInvoiceService.example.ts`
2. Check the test suite for usage patterns
3. Consult the main SPEC.md for business requirements
4. Review ROADMAP.md for feature timeline

## Changelog

### Version 1.0.0 (2024-01-12)

- Initial implementation
- Core functions: create, validate, calculate, update
- Three display modes: itemized, totaled, hybrid
- Comprehensive test suite
- Example usage scenarios
- Full TypeScript type safety

## License

Part of Graceful Books - see main project LICENSE file.
