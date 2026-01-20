/**
 * CustomerList Component
 *
 * Displays a searchable, filterable list of customers.
 *
 * Features:
 * - Search by name, email, or phone
 * - Filter by status
 * - Sort by various criteria
 * - Hierarchical view support with expand/collapse (G3)
 * - Tree structure visualization for parent/child accounts
 * - Toggle between flat and tree view
 * - Empty state with encouragement
 * - WCAG 2.1 AA accessible
 *
 * Per ACCT-002: Customer Management
 * Per G3: Hierarchical Contacts
 */

import { type FC, useState, useMemo } from 'react'
import { Input } from '../forms/Input'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import { CustomerCard } from './CustomerCard'
import { HierarchyIndicator } from '../contacts/HierarchyIndicator'
import type { Contact } from '../../types'
import styles from './CustomerList.module.css'

export interface CustomerListProps {
  /**
   * Customers to display
   */
  customers: Contact[]

  /**
   * Called when a customer is selected for editing
   */
  onEdit?: (customer: Contact) => void

  /**
   * Called when a customer is selected for deletion
   */
  onDelete?: (customer: Contact) => void

  /**
   * Called when create button is clicked
   */
  onCreate?: () => void

  /**
   * Whether data is currently loading
   */
  isLoading?: boolean

  /**
   * Show milestone celebrations (pass customer count)
   */
  customerCount?: number
}

type SortBy = 'name' | 'email' | 'recent'
type ViewMode = 'flat' | 'tree'

/**
 * Get milestone message if applicable
 */
function getMilestoneMessage(count: number): string | null {
  const milestones: Record<number, string> = {
    1: "Your first customer! Every business started with one.",
    10: "10 customers! Your client base is growing.",
    25: "25 customers! You're building something special.",
    50: "50 customers! Half a hundred strong!",
    100: "100 customers! What an incredible milestone!",
  }

  return milestones[count] || null
}

/**
 * Build a hierarchical tree structure from flat list of contacts
 */
function buildHierarchy(contacts: Contact[]): Contact[] {
  const contactMap = new Map<string, Contact & { children?: Contact[] }>()
  const rootContacts: Contact[] = []

  // First pass: Create map and identify root contacts
  contacts.forEach(contact => {
    contactMap.set(contact.id, { ...contact, children: [] })
  })

  // Second pass: Build tree structure
  contacts.forEach(contact => {
    const node = contactMap.get(contact.id)
    if (!node) return

    if (contact.parentId) {
      const parent = contactMap.get(contact.parentId)
      if (parent && parent.children) {
        parent.children.push(node)
      } else {
        // Parent not found, treat as root
        rootContacts.push(node)
      }
    } else {
      rootContacts.push(node)
    }
  })

  // Sort children within each parent
  const sortChildren = (items: (Contact & { children?: Contact[] })[]): void => {
    items.forEach(item => {
      if (item.children && item.children.length > 0) {
        item.children.sort((a, b) => a.name.localeCompare(b.name))
        sortChildren(item.children)
      }
    })
  }
  sortChildren(rootContacts)

  return rootContacts
}

/**
 * Flatten hierarchical tree back to list for rendering
 */
function flattenHierarchy(contacts: Contact[]): Contact[] {
  const result: Contact[] = []

  const traverse = (items: (Contact & { children?: Contact[] })[]): void => {
    items.forEach(item => {
      result.push(item)
      if (item.children && item.children.length > 0) {
        traverse(item.children)
      }
    })
  }

  traverse(contacts)
  return result
}

/**
 * CustomerList Component
 */
export const CustomerList: FC<CustomerListProps> = ({
  customers,
  onEdit,
  onDelete,
  onCreate,
  isLoading = false,
  customerCount,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Check if any customers have hierarchical relationships
  const hasHierarchy = useMemo(() => {
    return customers.some(c => c.parentId || c.accountType === 'parent')
  }, [customers])

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (customer) =>
          customer.name.toLowerCase().includes(term) ||
          customer.email?.toLowerCase().includes(term) ||
          customer.phone?.includes(term) ||
          customer.address?.city?.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((customer) => customer.isActive)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((customer) => !customer.isActive)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'email':
          if (a.email && b.email) {
            return a.email.localeCompare(b.email)
          }
          return a.name.localeCompare(b.name)
        case 'recent':
          return b.createdAt.getTime() - a.createdAt.getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [customers, searchTerm, filterStatus, sortBy])

  // Build hierarchical structure if in tree view
  const displayCustomers = useMemo(() => {
    if (viewMode === 'tree' && hasHierarchy) {
      const tree = buildHierarchy(filteredCustomers)
      return flattenHierarchy(tree)
    }
    return filteredCustomers
  }, [filteredCustomers, viewMode, hasHierarchy])

  // Get children count for parent accounts
  const getChildrenCount = (parentId: string): number => {
    return customers.filter(c => c.parentId === parentId).length
  }

  // Get parent name for child accounts
  const getParentName = (parentId?: string | null): string | undefined => {
    if (!parentId) return undefined
    const parent = customers.find(c => c!.id === parentId)
    return parent?.name
  }

  // Toggle expand/collapse for parent accounts
  const toggleExpand = (customerId: string): void => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }

  // Check if customer should be visible based on parent expansion
  const isVisible = (customer: Contact): boolean => {
    if (!customer.parentId || viewMode === 'flat') return true
    return expandedIds.has(customer.parentId)
  }

  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Customers' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' },
  ]

  const sortOptions: SelectOption[] = [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'recent', label: 'Recently Added' },
  ]

  const milestoneMessage = customerCount ? getMilestoneMessage(customerCount) : null

  if (isLoading) {
    return (
      <div className={styles.customerList}>
        <div className={styles.loading}>Getting everything ready for you...</div>
      </div>
    )
  }

  return (
    <div className={styles.customerList}>
      {milestoneMessage && (
        <div className={styles.celebration} role="status" aria-live="polite">
          <span className={styles.celebrationIcon} aria-hidden="true">🎉</span>
          <p className={styles.celebrationText}>{milestoneMessage}</p>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <Input
            type="search"
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            aria-label="Search customers"
          />
        </div>

        <div className={styles.filters}>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={statusOptions}
            aria-label="Filter by status"
          />

          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            options={sortOptions}
            aria-label="Sort by"
          />

          {hasHierarchy && (
            <div className={styles.viewToggle}>
              <Button
                variant={viewMode === 'flat' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('flat')}
                aria-label="View as flat list"
                aria-pressed={viewMode === 'flat'}
              >
                Flat
              </Button>
              <Button
                variant={viewMode === 'tree' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('tree')}
                aria-label="View as tree structure"
                aria-pressed={viewMode === 'tree'}
              >
                Tree
              </Button>
            </div>
          )}
        </div>

        {onCreate && (
          <div className={styles.actions}>
            <Button variant="primary" onClick={onCreate}>
              Add Customer
            </Button>
          </div>
        )}
      </div>

      <div className={styles.results}>
        <p className={styles.resultsCount} aria-live="polite">
          {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
        </p>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className={styles.emptyState}>
          {customers.length === 0 ? (
            <>
              <div className={styles.emptyIcon} aria-hidden="true">👥</div>
              <h3 className={styles.emptyTitle}>Let's add your first customer!</h3>
              <p className={styles.emptyDescription}>
                Every business started with one. Click "Add Customer" above to get started.
              </p>
            </>
          ) : (
            <>
              <p className={styles.emptyTitle}>No customers found</p>
              <p className={styles.emptyDescription}>Try adjusting your search or filters</p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.content}>
          <div className={viewMode === 'tree' ? styles.treeView : styles.cardGrid}>
            {displayCustomers.filter(isVisible).map((customer) => {
              const childCount = getChildrenCount(customer.id)
              const parentName = getParentName(customer.parentId)
              const isExpanded = expandedIds.has(customer.id)
              const hasChildren = childCount > 0

              return (
                <div
                  key={customer.id}
                  className={styles.customerItem}
                  style={{
                    '--hierarchy-level': customer.hierarchyLevel || 0,
                  } as React.CSSProperties}
                >
                  {viewMode === 'tree' && (customer.accountType === 'parent' || customer.accountType === 'child') && (
                    <div className={styles.hierarchySection}>
                      {hasChildren && viewMode === 'tree' && (
                        <button
                          className={styles.expandButton}
                          onClick={() => toggleExpand(customer.id)}
                          aria-label={isExpanded ? 'Collapse sub-accounts' : 'Expand sub-accounts'}
                          aria-expanded={isExpanded}
                        >
                          <svg
                            className={styles.expandIcon}
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            style={{
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                            }}
                          >
                            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
                          </svg>
                        </button>
                      )}
                      <HierarchyIndicator
                        contact={customer as any}
                        view="compact"
                        subAccountCount={childCount}
                        parentName={parentName}
                      />
                    </div>
                  )}
                  <CustomerCard
                    customer={customer}
                    showActions
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
