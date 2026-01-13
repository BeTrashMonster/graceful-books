/**
 * HierarchyIndicator Usage Examples
 *
 * Demonstrates various use cases for the HierarchyIndicator component
 */

import { HierarchyIndicator } from './HierarchyIndicator'
import type { Contact } from '../../types/database.types'
import { ContactAccountType, ContactType } from '../../types/database.types'

/**
 * Example: Standalone Contact
 */
export function StandaloneExample() {
  const standaloneContact: Contact = {
    id: 'contact-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Standalone Customer',
    email: 'customer@example.com',
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '1500.00',
    parent_id: null,
    account_type: ContactAccountType.STANDALONE,
    hierarchy_level: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Standalone Contact (Compact View)</h3>
      <HierarchyIndicator contact={standaloneContact} view="compact" />
      <p style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
        Note: Standalone contacts show nothing in compact view
      </p>

      <h3 style={{ marginTop: '30px' }}>Standalone Contact (Expanded View)</h3>
      <HierarchyIndicator contact={standaloneContact} view="expanded" />
    </div>
  )
}

/**
 * Example: Parent Contact with Sub-accounts
 */
export function ParentExample() {
  const parentContact: Contact = {
    id: 'parent-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Acme Corporation',
    email: 'billing@acme.com',
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '15000.00',
    parent_id: null,
    account_type: ContactAccountType.PARENT,
    hierarchy_level: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Parent Contact with 3 Sub-accounts (Compact View)</h3>
      <HierarchyIndicator
        contact={parentContact}
        view="compact"
        subAccountCount={3}
      />

      <h3 style={{ marginTop: '30px' }}>
        Parent Contact with 3 Sub-accounts (Expanded View)
      </h3>
      <HierarchyIndicator
        contact={parentContact}
        view="expanded"
        subAccountCount={3}
      />

      <h3 style={{ marginTop: '30px' }}>
        Parent Contact with 1 Sub-account (Shows Singular Form)
      </h3>
      <HierarchyIndicator
        contact={parentContact}
        view="expanded"
        subAccountCount={1}
      />
    </div>
  )
}

/**
 * Example: Child Contact (Sub-account)
 */
export function ChildExample() {
  const childContact: Contact = {
    id: 'child-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Acme Corp - East Coast',
    email: 'east@acme.com',
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '3500.00',
    parent_id: 'parent-1',
    account_type: ContactAccountType.CHILD,
    hierarchy_level: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  const handleNavigateToParent = (parentId: string) => {
    console.log('Navigate to parent:', parentId)
    // In real app: navigate(`/contacts/${parentId}`)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Child Contact (Compact View)</h3>
      <HierarchyIndicator contact={childContact} view="compact" />

      <h3 style={{ marginTop: '30px' }}>
        Child Contact with Parent Navigation (Expanded View)
      </h3>
      <HierarchyIndicator
        contact={childContact}
        view="expanded"
        parentName="Acme Corporation"
        onNavigateToParent={handleNavigateToParent}
      />

      <h3 style={{ marginTop: '30px' }}>
        Child Contact without Navigation (Expanded View)
      </h3>
      <HierarchyIndicator
        contact={childContact}
        view="expanded"
        parentName="Acme Corporation"
      />
    </div>
  )
}

/**
 * Example: Multi-level Hierarchy
 */
export function MultiLevelExample() {
  const level1Contact: Contact = {
    id: 'child-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Regional Office',
    email: null,
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '5000.00',
    parent_id: 'parent-1',
    account_type: ContactAccountType.CHILD,
    hierarchy_level: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  const level2Contact: Contact = {
    id: 'child-2',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'District Office',
    email: null,
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '2000.00',
    parent_id: 'child-1',
    account_type: ContactAccountType.CHILD,
    hierarchy_level: 2,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  const level3Contact: Contact = {
    id: 'child-3',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Local Office',
    email: null,
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '500.00',
    parent_id: 'child-2',
    account_type: ContactAccountType.CHILD,
    hierarchy_level: 3,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Level 1 Sub-account</h3>
      <HierarchyIndicator
        contact={level1Contact}
        view="expanded"
        parentName="Headquarters"
      />

      <h3 style={{ marginTop: '30px' }}>Level 2 Sub-account</h3>
      <HierarchyIndicator
        contact={level2Contact}
        view="expanded"
        parentName="Regional Office"
      />

      <h3 style={{ marginTop: '30px' }}>
        Level 3 Sub-account (Maximum Depth)
      </h3>
      <HierarchyIndicator
        contact={level3Contact}
        view="expanded"
        parentName="District Office"
      />
    </div>
  )
}

/**
 * Example: In a Contact Card
 */
export function ContactCardIntegrationExample() {
  const parentContact: Contact = {
    id: 'parent-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Global Enterprises Inc.',
    email: 'billing@global.com',
    phone: '+1-555-0100',
    address: null,
    tax_id: null,
    notes: 'Primary account for all divisions',
    active: true,
    balance: '25000.00',
    parent_id: null,
    account_type: ContactAccountType.PARENT,
    hierarchy_level: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  const childContact: Contact = {
    id: 'child-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Global Enterprises - North America',
    email: 'na@global.com',
    phone: '+1-555-0101',
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '8500.00',
    parent_id: 'parent-1',
    account_type: ContactAccountType.CHILD,
    hierarchy_level: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Parent Contact in Card</h3>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '10px',
        }}
      >
        <h4 style={{ margin: '0 0 12px 0' }}>{parentContact.name}</h4>
        <HierarchyIndicator
          contact={parentContact}
          view="expanded"
          subAccountCount={5}
        />
        <div style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
          <div>Email: {parentContact.email}</div>
          <div>Phone: {parentContact.phone}</div>
          <div style={{ marginTop: '8px' }}>Balance: ${parentContact.balance}</div>
        </div>
      </div>

      <h3 style={{ marginTop: '30px' }}>Child Contact in Card</h3>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '10px',
        }}
      >
        <h4 style={{ margin: '0 0 12px 0' }}>{childContact.name}</h4>
        <HierarchyIndicator
          contact={childContact}
          view="expanded"
          parentName="Global Enterprises Inc."
          onNavigateToParent={(id) => console.log('Navigate to:', id)}
        />
        <div style={{ marginTop: '12px', color: '#666', fontSize: '14px' }}>
          <div>Email: {childContact.email}</div>
          <div>Phone: {childContact.phone}</div>
          <div style={{ marginTop: '8px' }}>Balance: ${childContact.balance}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Example: All Variants Side-by-Side
 */
export function AllVariantsExample() {
  const standaloneContact: Contact = {
    id: 'contact-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Standalone Inc.',
    email: null,
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '1000.00',
    parent_id: null,
    account_type: ContactAccountType.STANDALONE,
    hierarchy_level: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
  }

  const parentContact: Contact = {
    ...standaloneContact,
    id: 'parent-1',
    name: 'Parent Corp.',
    account_type: ContactAccountType.PARENT,
  }

  const childContact: Contact = {
    ...standaloneContact,
    id: 'child-1',
    name: 'Child Division',
    parent_id: 'parent-1',
    account_type: ContactAccountType.CHILD,
    hierarchy_level: 1,
  }

  return (
    <div style={{ padding: '20px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
        }}
      >
        <div>
          <h4>Standalone</h4>
          <HierarchyIndicator contact={standaloneContact} view="expanded" />
        </div>
        <div>
          <h4>Parent (5 sub-accounts)</h4>
          <HierarchyIndicator
            contact={parentContact}
            view="expanded"
            subAccountCount={5}
          />
        </div>
        <div>
          <h4>Child (Level 1)</h4>
          <HierarchyIndicator
            contact={childContact}
            view="expanded"
            parentName="Parent Corp."
            onNavigateToParent={(id) => console.log('Navigate to:', id)}
          />
        </div>
      </div>
    </div>
  )
}
