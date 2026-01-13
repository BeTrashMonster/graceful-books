# Capability Spec: Client Management

## Overview
The Client Management capability provides basic customer/client record management for invoicing and relationship tracking. It enables users to store contact information, track customer history, and manage client relationships.

## ADDED Requirements


### ACCT-002: Client Management (subset)
**Priority:** Critical
**Category:** Accounting

**CLIENT MANAGEMENT:**
1. Client profiles with contact info
2. Communication history
3. Payment history and patterns
4. Outstanding balance dashboard
5. Client-specific pricing/terms
6. Notes and attachments
7. Client portal (view/pay invoices) - *Future enhancement*

**For Group C (Basic):**
- Client creation and editing
- Contact information storage
- Client list view
- Search and filter
- Notes field
- Active/inactive status

**ACCEPTANCE CRITERIA:**
- [ ] Client creation form validates required fields
- [ ] Client list supports search by name, email, phone
- [ ] Filter by active/inactive status
- [ ] Client records encrypted at rest
- [ ] Export client list (CSV)

## Data Models

### Client
```typescript
interface Client {
  id: string;
  companyId: string; // Multi-company support

  // Basic information
  type: 'individual' | 'business';
  displayName: string; // Required
  firstName?: string; // For individuals
  lastName?: string; // For individuals
  businessName?: string; // For businesses

  // Contact information
  email?: string;
  phone?: string;
  website?: string;

  // Address
  billingAddress?: Address;
  shippingAddress?: Address;
  sameAsbilling: boolean;

  // Business details
  taxId?: string; // EIN or SSN (encrypted)
  currency: string; // Default 'USD'

  // Status
  status: 'active' | 'inactive';
  inactivatedAt?: Date;
  inactivationReason?: string;

  // Notes
  notes?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID
  lastModifiedBy: string;

  // Statistics (calculated)
  stats?: ClientStats;
}

interface Address {
  street1: string;
  street2?: string;
  city: string;
  state?: string; // Province/State
  postalCode?: string;
  country: string;
}

interface ClientStats {
  totalInvoices: number;
  totalBilled: number; // Sum of all invoices
  totalPaid: number; // Sum of payments received
  outstandingBalance: number; // Unpaid invoices
  lastInvoiceDate?: Date;
  lastPaymentDate?: Date;
  averageDaysToPay?: number; // Payment pattern
}
```

## API

### Client Management API
```typescript
interface ClientManagementEngine {
  // CRUD operations
  createClient(client: CreateClientInput): Promise<Client>;
  getClient(clientId: string): Promise<Client>;
  updateClient(clientId: string, updates: UpdateClientInput): Promise<Client>;
  deleteClient(clientId: string): Promise<void>; // Soft delete

  // List and search
  listClients(options?: ListOptions): Promise<ClientList>;
  searchClients(query: string): Promise<Client[]>;

  // Status management
  activateClient(clientId: string): Promise<Client>;
  deactivateClient(clientId: string, reason: string): Promise<Client>;

  // Statistics
  getClientStats(clientId: string): Promise<ClientStats>;
  refreshClientStats(clientId: string): Promise<ClientStats>;

  // Export
  exportClients(format: 'csv' | 'json', filter?: ClientFilter): Promise<Blob>;

  // Validation
  validateClient(client: Partial<Client>): ValidationResult;
  checkDuplicate(
    displayName: string,
    email?: string
  ): Promise<DuplicateCheckResult>;
}

interface CreateClientInput {
  type: 'individual' | 'business';
  displayName: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  website?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  sameAsBinding: boolean;
  taxId?: string;
  notes?: string;
}

interface UpdateClientInput {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  website?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  sameAsBinding?: boolean;
  taxId?: string;
  notes?: string;
}

interface ListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'created' | 'lastInvoice' | 'balance';
  sortOrder?: 'asc' | 'desc';
  filter?: ClientFilter;
}

interface ClientFilter {
  status?: 'active' | 'inactive' | 'all';
  type?: 'individual' | 'business' | 'all';
  hasOutstandingBalance?: boolean;
  search?: string;
}

interface ClientList {
  clients: Client[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  potentialMatches: Client[];
  confidence: 'high' | 'medium' | 'low';
}
```

## Business Logic

### Client Creation
```typescript
async function createClient(input: CreateClientInput): Promise<Client> {
  // Validation
  const validation = validateClientInput(input);
  if (!validation.valid) {
    throw new ValidationError(validation.errors);
  }

  // Duplicate check
  const duplicateCheck = await checkDuplicate(
    input.displayName,
    input.email
  );

  if (duplicateCheck.isDuplicate && duplicateCheck.confidence === 'high') {
    throw new DuplicateClientError(duplicateCheck.potentialMatches);
  }

  // Encrypt sensitive data
  const encryptedTaxId = input.taxId
    ? await encrypt(input.taxId)
    : undefined;

  // Create record
  const client: Client = {
    id: generateId(),
    companyId: getCurrentCompanyId(),
    type: input.type,
    displayName: input.displayName,
    firstName: input.firstName,
    lastName: input.lastName,
    businessName: input.businessName,
    email: input.email?.toLowerCase(),
    phone: normalizePhone(input.phone),
    website: normalizeUrl(input.website),
    billingAddress: input.billingAddress,
    shippingAddress: input.sameAsBinding
      ? input.billingAddress
      : input.shippingAddress,
    sameAsBinding: input.sameAsBinding,
    taxId: encryptedTaxId,
    currency: 'USD',
    status: 'active',
    notes: input.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: getCurrentUserId(),
    lastModifiedBy: getCurrentUserId()
  };

  // Save
  await saveClient(client);

  // Audit log
  await logAuditEvent({
    type: 'client-created',
    entityId: client.id,
    userId: getCurrentUserId(),
    timestamp: new Date()
  });

  return client;
}
```

### Validation Rules
```typescript
function validateClientInput(input: CreateClientInput): ValidationResult {
  const errors: ValidationError[] = [];

  // Display name required
  if (!input.displayName || input.displayName.trim() === '') {
    errors.push({
      field: 'displayName',
      message: 'Client name is required',
      code: 'REQUIRED'
    });
  }

  // Type-specific validation
  if (input.type === 'individual') {
    if (!input.firstName && !input.lastName) {
      errors.push({
        field: 'firstName',
        message: 'First name or last name required for individuals',
        code: 'REQUIRED'
      });
    }
  } else if (input.type === 'business') {
    if (!input.businessName) {
      errors.push({
        field: 'businessName',
        message: 'Business name required for business clients',
        code: 'REQUIRED'
      });
    }
  }

  // Email format
  if (input.email && !isValidEmail(input.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_FORMAT'
    });
  }

  // Phone format (optional but must be valid if provided)
  if (input.phone && !isValidPhone(input.phone)) {
    errors.push({
      field: 'phone',
      message: 'Invalid phone format',
      code: 'INVALID_FORMAT'
    });
  }

  // Website URL (optional but must be valid if provided)
  if (input.website && !isValidUrl(input.website)) {
    errors.push({
      field: 'website',
      message: 'Invalid website URL',
      code: 'INVALID_FORMAT'
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### Duplicate Detection
```typescript
async function checkDuplicate(
  displayName: string,
  email?: string
): Promise<DuplicateCheckResult> {
  const potentialMatches: Client[] = [];

  // Exact name match
  const exactNameMatch = await findClientsByName(displayName);
  if (exactNameMatch.length > 0) {
    potentialMatches.push(...exactNameMatch);
    return {
      isDuplicate: true,
      potentialMatches,
      confidence: 'high'
    };
  }

  // Email match (if provided)
  if (email) {
    const emailMatch = await findClientsByEmail(email);
    if (emailMatch.length > 0) {
      potentialMatches.push(...emailMatch);
      return {
        isDuplicate: true,
        potentialMatches,
        confidence: 'high'
      };
    }
  }

  // Fuzzy name match (Levenshtein distance)
  const fuzzyMatches = await findClientsByFuzzyName(displayName, 0.8);
  if (fuzzyMatches.length > 0) {
    potentialMatches.push(...fuzzyMatches);
    return {
      isDuplicate: true,
      potentialMatches,
      confidence: 'medium'
    };
  }

  return {
    isDuplicate: false,
    potentialMatches: [],
    confidence: 'low'
  };
}
```

### Statistics Calculation
```typescript
async function calculateClientStats(clientId: string): Promise<ClientStats> {
  const invoices = await getInvoicesByClient(clientId);

  const stats: ClientStats = {
    totalInvoices: invoices.length,
    totalBilled: 0,
    totalPaid: 0,
    outstandingBalance: 0,
    lastInvoiceDate: undefined,
    lastPaymentDate: undefined,
    averageDaysToPay: undefined
  };

  if (invoices.length === 0) {
    return stats;
  }

  // Calculate totals
  invoices.forEach(invoice => {
    stats.totalBilled += invoice.total;

    if (invoice.status === 'paid') {
      stats.totalPaid += invoice.total;

      if (!stats.lastPaymentDate || invoice.paidDate > stats.lastPaymentDate) {
        stats.lastPaymentDate = invoice.paidDate;
      }
    } else if (invoice.status === 'sent' || invoice.status === 'overdue') {
      stats.outstandingBalance += invoice.total;
    }

    if (!stats.lastInvoiceDate || invoice.date > stats.lastInvoiceDate) {
      stats.lastInvoiceDate = invoice.date;
    }
  });

  // Calculate average days to pay
  const paidInvoices = invoices.filter(i => i.status === 'paid' && i.paidDate);
  if (paidInvoices.length > 0) {
    const totalDays = paidInvoices.reduce((sum, invoice) => {
      const days = daysBetween(invoice.date, invoice.paidDate!);
      return sum + days;
    }, 0);
    stats.averageDaysToPay = Math.round(totalDays / paidInvoices.length);
  }

  return stats;
}
```

## UI Components

### ClientList
Main list view of all clients.

**Props:**
- `companyId: string`
- `onClientSelect: (client: Client) => void`

**Features:**
- Table view with sortable columns:
  - Name
  - Email
  - Phone
  - Outstanding Balance
  - Last Invoice
  - Status
- Search box (filters in real-time)
- Filter dropdown (Active/Inactive/All)
- Pagination controls
- "New Client" button
- Export button (CSV)
- Empty state with "Add your first client" prompt

### ClientForm
Create/edit client form.

**Props:**
- `client?: Client` (for editing)
- `onSave: (client: Client) => void`
- `onCancel: () => void`

**Features:**
- Type selection (Individual/Business)
- Conditional fields based on type
- Contact information section
- Billing/shipping address (with "same as billing" checkbox)
- Tax ID (optional, masked input)
- Notes textarea
- Validation with inline error messages
- Duplicate warning if detected
- Save/Cancel buttons

### ClientCard
Compact card view for individual client.

**Props:**
- `client: Client`
- `onClick?: () => void`
- `showActions?: boolean`

**Features:**
- Client name and type icon
- Contact info (email, phone)
- Outstanding balance (if any)
- Status badge
- Quick actions menu (edit, deactivate, view invoices)

### ClientDetail
Detailed view of single client.

**Props:**
- `client: Client`
- `onEdit: () => void`
- `onBack: () => void`

**Features:**
- Contact information display
- Address display
- Notes display
- Statistics summary:
  - Total invoices
  - Total billed
  - Outstanding balance
  - Average days to pay
- Related invoices list
- Activity timeline (future)
- Edit/Deactivate buttons

### ClientSearch
Search and quick-add component.

**Props:**
- `onSelect: (client: Client) => void`
- `onCreateNew?: (name: string) => void`
- `placeholder?: string`

**Features:**
- Autocomplete search
- Shows top matches as user types
- "Create new client" option if no match
- Keyboard navigation
- Recent clients (last 5 used)

## User Experience

### First Client Moment
When user creates first client:
- Celebration message: "Your first customer! Every business started with one."
- Helpful tooltip: "Now you can create invoices for [Client Name]"
- Suggest creating first invoice

### Milestones
- **10 clients:** "10 customers! Your client base is growing."
- **50 clients:** "50 customers! You're building something real."
- **100 clients:** "100 customers! That's a significant client base."

### Empty States
**No clients yet:**
```
No clients yet
Add your first client to start invoicing.
[+ Add Client]
```

**No search results:**
```
No clients found matching "[query]"
Try a different search or add a new client.
[+ Add "[query]" as new client]
```

**All inactive:**
```
All your clients are inactive
Activate a client or add a new one.
[View Inactive Clients]
```

### Tone & Messaging
- **Welcoming:** "Add your clients here so you can invoice them easily"
- **Helpful:** "We'll remember their details so you don't have to retype them"
- **Encouraging:** "Great! Now you can send [Client] professional invoices"
- **Non-judgmental:** Status is "Inactive" not "Deleted" or "Closed"

## Testing Requirements

### Unit Tests
- Client validation rules
- Duplicate detection algorithm
- Statistics calculation
- Email/phone normalization
- Address validation

### Integration Tests
- Create client end-to-end
- Update client preserves invoices
- Search returns correct results
- Filter by status works
- Export generates valid CSV

### User Testing
- Client creation completes in <2 minutes
- Duplicate detection catches obvious duplicates
- Search finds clients quickly (<3 keystrokes on average)
- Users understand active/inactive status

## Performance Requirements
- Client list loads <1 second (up to 1000 clients)
- Search returns results <500ms
- Client creation <1 second
- Statistics recalculation <2 seconds
- Export <5 seconds for 1000 clients

## Data Privacy & Security
- Tax ID encrypted at rest using AES-256
- Email addresses normalized and indexed for search
- Phone numbers stored in normalized format
- Soft delete only (never hard delete to preserve invoice history)
- Audit log of all create/update/delete operations

## Accessibility
- Full keyboard navigation
- Screen reader labels for all form fields
- ARIA live region for search results
- High contrast mode support
- WCAG 2.1 AA compliance

## Future Enhancements (Post-Group C)
- Communication history (emails, calls logged)
- Payment history and patterns
- Client-specific pricing and terms
- Client portal for self-service
- Attachments (contracts, W-9s, etc.)
- Custom fields
- Client groups/tags
- Import from other systems (CSV, QuickBooks, etc.)
- Client merge functionality
- Multi-contact per client (primary, billing, shipping)
- Client lifecycle stages (lead, active, inactive, archived)
