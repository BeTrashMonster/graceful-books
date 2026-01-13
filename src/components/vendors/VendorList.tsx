/**
 * VendorList Component
 *
 * Displays a searchable, filterable list of vendors.
 *
 * Features:
 * - Search by name, email, or phone
 * - Filter by status and 1099 eligibility
 * - Sort by various criteria
 * - Hierarchical view support with expand/collapse (G3)
 * - Tree structure visualization for parent/child accounts
 * - Toggle between flat and tree view
 * - Empty state with encouragement
 * - Milestone celebrations
 * - WCAG 2.1 AA accessible
 *
 * Per D5: Vendor Management - Basic [MVP]
 * Per G3: Hierarchical Contacts
 */

import { type FC, useState, useMemo } from 'react'
import { Input } from '../forms/Input'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import { VendorCard } from './VendorCard'
import { HierarchyIndicator } from '../contacts/HierarchyIndicator'
import type { Vendor } from '../../types/vendor.types'
import styles from './VendorList.module.css'

export interface VendorListProps {
  /**
   * Vendors to display
   */
  vendors: Vendor[]

  /**
   * Called when a vendor is selected for editing
   */
  onEdit?: (vendor: Vendor) => void

  /**
   * Called when a vendor is selected for deletion
   */
  onDelete?: (vendor: Vendor) => void

  /**
   * Called when create button is clicked
   */
  onCreate?: () => void

  /**
   * Whether data is currently loading
   */
  isLoading?: boolean

  /**
   * Show milestone celebrations (pass vendor count)
   */
  vendorCount?: number
}

type SortBy = 'name' | 'email' | 'recent'
type ViewMode = 'flat' | 'tree'

/**
 * Get milestone message if applicable
 */
function getMilestoneMessage(count: number): string | null {
  const milestones: Record<number, string> = {
    1: "Your first vendor! Every business has expenses.",
    10: "10 vendors! Your network is expanding.",
    25: "25 vendors! You're building strong relationships.",
    50: "50 vendors! That's quite a network!",
    100: "100 vendors! An impressive list of partners!",
  }

  return milestones[count] || null
}

/**
 * Build a hierarchical tree structure from flat list of vendors
 */
function buildHierarchy(vendors: Vendor[]): Vendor[] {
  const vendorMap = new Map<string, Vendor & { children?: Vendor[] }>()
  const rootVendors: Vendor[] = []

  // First pass: Create map and identify root vendors
  vendors.forEach(vendor => {
    vendorMap.set(vendor.id, { ...vendor, children: [] })
  })

  // Second pass: Build tree structure
  vendors.forEach(vendor => {
    const node = vendorMap.get(vendor.id)
    if (!node) return

    if (vendor.parentId) {
      const parent = vendorMap.get(vendor.parentId)
      if (parent && parent.children) {
        parent.children.push(node)
      } else {
        // Parent not found, treat as root
        rootVendors.push(node)
      }
    } else {
      rootVendors.push(node)
    }
  })

  // Sort children within each parent
  const sortChildren = (items: (Vendor & { children?: Vendor[] })[]): void => {
    items.forEach(item => {
      if (item.children && item.children.length > 0) {
        item.children.sort((a, b) => a.name.localeCompare(b.name))
        sortChildren(item.children)
      }
    })
  }
  sortChildren(rootVendors)

  return rootVendors
}

/**
 * Flatten hierarchical tree back to list for rendering
 */
function flattenHierarchy(vendors: Vendor[]): Vendor[] {
  const result: Vendor[] = []

  const traverse = (items: (Vendor & { children?: Vendor[] })[]): void => {
    items.forEach(item => {
      result.push(item)
      if (item.children && item.children.length > 0) {
        traverse(item.children)
      }
    })
  }

  traverse(vendors)
  return result
}

/**
 * VendorList Component
 */
export const VendorList: FC<VendorListProps> = ({
  vendors,
  onEdit,
  onDelete,
  onCreate,
  isLoading = false,
  vendorCount,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [filter1099, setFilter1099] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Check if any vendors have hierarchical relationships
  const hasHierarchy = useMemo(() => {
    return vendors.some(v => v.parentId || v.accountType === 'parent')
  }, [vendors])

  // Filter and sort vendors
  const filteredVendors = useMemo(() => {
    let filtered = [...vendors]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(term) ||
          vendor.email?.toLowerCase().includes(term) ||
          vendor.phone?.includes(term) ||
          vendor.address?.city?.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter((vendor) => vendor.isActive)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter((vendor) => !vendor.isActive)
    }

    // 1099 eligibility filter
    if (filter1099 === 'eligible') {
      filtered = filtered.filter((vendor) => vendor.is1099Eligible)
    } else if (filter1099 === 'not-eligible') {
      filtered = filtered.filter((vendor) => !vendor.is1099Eligible)
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
  }, [vendors, searchTerm, filterStatus, filter1099, sortBy])

  // Build hierarchical structure if in tree view
  const displayVendors = useMemo(() => {
    if (viewMode === 'tree' && hasHierarchy) {
      const tree = buildHierarchy(filteredVendors)
      return flattenHierarchy(tree)
    }
    return filteredVendors
  }, [filteredVendors, viewMode, hasHierarchy])

  // Get children count for parent accounts
  const getChildrenCount = (parentId: string): number => {
    return vendors.filter(v => v.parentId === parentId).length
  }

  // Get parent name for child accounts
  const getParentName = (parentId?: string | null): string | undefined => {
    if (!parentId) return undefined
    const parent = vendors.find(v => v.id === parentId)
    return parent?.name
  }

  // Toggle expand/collapse for parent accounts
  const toggleExpand = (vendorId: string): void => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(vendorId)) {
        next.delete(vendorId)
      } else {
        next.add(vendorId)
      }
      return next
    })
  }

  // Check if vendor should be visible based on parent expansion
  const isVisible = (vendor: Vendor): boolean => {
    if (!vendor.parentId || viewMode === 'flat') return true
    return expandedIds.has(vendor.parentId)
  }

  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Vendors' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' },
  ]

  const eligible1099Options: SelectOption[] = [
    { value: 'all', label: 'All 1099 Status' },
    { value: 'eligible', label: '1099 Eligible' },
    { value: 'not-eligible', label: 'Not 1099 Eligible' },
  ]

  const sortOptions: SelectOption[] = [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'recent', label: 'Recently Added' },
  ]

  const milestoneMessage = vendorCount ? getMilestoneMessage(vendorCount) : null

  if (isLoading) {
    return (
      <div className={styles.vendorList}>
        <div className={styles.loading}>Getting everything ready for you...</div>
      </div>
    )
  }

  return (
    <div className={styles.vendorList}>
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
            placeholder="Search vendors by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            aria-label="Search vendors"
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
            value={filter1099}
            onChange={(e) => setFilter1099(e.target.value)}
            options={eligible1099Options}
            aria-label="Filter by 1099 eligibility"
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
              Add Vendor
            </Button>
          </div>
        )}
      </div>

      <div className={styles.results}>
        <p className={styles.resultsCount} aria-live="polite">
          {filteredVendors.length} {filteredVendors.length === 1 ? 'vendor' : 'vendors'}
        </p>
      </div>

      {filteredVendors.length === 0 ? (
        <div className={styles.emptyState}>
          {vendors.length === 0 ? (
            <>
              <div className={styles.emptyIcon} aria-hidden="true">🏢</div>
              <h3 className={styles.emptyTitle}>Keeping track of who you pay helps you understand where your money goes</h3>
              <p className={styles.emptyDescription}>
                No judgment - just clarity. Click "Add Vendor" above to get started.
              </p>
            </>
          ) : (
            <>
              <p className={styles.emptyTitle}>No vendors found</p>
              <p className={styles.emptyDescription}>Try adjusting your search or filters</p>
            </>
          )}
        </div>
      ) : (
        <div className={styles.content}>
          <div className={viewMode === 'tree' ? styles.treeView : styles.cardGrid}>
            {displayVendors.filter(isVisible).map((vendor) => {
              const childCount = getChildrenCount(vendor.id)
              const parentName = getParentName(vendor.parentId)
              const isExpanded = expandedIds.has(vendor.id)
              const hasChildren = childCount > 0

              return (
                <div
                  key={vendor.id}
                  className={styles.vendorItem}
                  style={{
                    '--hierarchy-level': vendor.hierarchyLevel || 0,
                  } as React.CSSProperties}
                >
                  {viewMode === 'tree' && (vendor.accountType === 'parent' || vendor.accountType === 'child') && (
                    <div className={styles.hierarchySection}>
                      {hasChildren && viewMode === 'tree' && (
                        <button
                          className={styles.expandButton}
                          onClick={() => toggleExpand(vendor.id)}
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
                        contact={vendor as any}
                        view="compact"
                        subAccountCount={childCount}
                        parentName={parentName}
                      />
                    </div>
                  )}
                  <VendorCard
                    vendor={vendor}
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
