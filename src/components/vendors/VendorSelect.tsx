/**
 * VendorSelect Component
 *
 * Typeahead dropdown for selecting vendors with quick add functionality.
 * Features:
 * - Search existing vendors as you type
 * - Quick add vendor (just name)
 * - Open full vendor modal for detailed entry
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useVendors } from '../../hooks/useVendors'
import type { Vendor } from '../../types/vendor.types'
import styles from './VendorSelect.module.css'

export interface VendorSelectProps {
  value: string | null
  onChange: (vendorId: string | null, vendor?: Vendor) => void
  onCreateNew?: () => void
  companyId: string
  placeholder?: string
  disabled?: boolean
  error?: string
}

export function VendorSelect({
  value,
  onChange,
  onCreateNew,
  companyId,
  placeholder = 'Search or add vendor...',
  disabled = false,
  error,
}: VendorSelectProps) {
  const { vendors, create, isLoading } = useVendors({ companyId, isActive: true })
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find selected vendor
  const selectedVendor = useMemo(() => {
    if (!value) return null
    return vendors.find((v) => v.id === value) || null
  }, [value, vendors])

  // Filter vendors based on search
  const filteredVendors = useMemo(() => {
    if (!searchTerm.trim()) return vendors.slice(0, 10) // Show first 10 if no search
    const term = searchTerm.toLowerCase()
    return vendors
      .filter(
        (v) =>
          v.name.toLowerCase().includes(term) ||
          v.email?.toLowerCase().includes(term)
      )
      .slice(0, 10)
  }, [vendors, searchTerm])

  // Check if search term matches any vendor exactly
  const exactMatch = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return vendors.some((v) => v.name.toLowerCase() === term)
  }, [vendors, searchTerm])

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleSelectVendor = (vendor: Vendor) => {
    onChange(vendor.id, vendor)
    setSearchTerm('')
    setIsOpen(false)
  }

  const handleQuickAdd = async () => {
    if (!searchTerm.trim() || isCreating) return

    setIsCreating(true)
    try {
      const result = await create({
        companyId,
        type: 'vendor',
        name: searchTerm.trim(),
        isActive: true,
      })

      if (result.success) {
        onChange(result.data.id, result.data)
        setSearchTerm('')
        setIsOpen(false)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleClear = () => {
    onChange(null)
    setSearchTerm('')
  }

  const displayValue = selectedVendor ? selectedVendor.name : searchTerm

  return (
    <div className={styles.container} ref={dropdownRef}>
      <div className={`${styles.inputWrapper} ${error ? styles.hasError : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={styles.input}
          autoComplete="off"
        />
        {selectedVendor && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={styles.clearButton}
            aria-label="Clear selection"
          >
            &times;
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className={styles.dropdown}>
          {/* Vendor list */}
          {filteredVendors.length > 0 && (
            <div className={styles.vendorList}>
              {filteredVendors.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => handleSelectVendor(vendor)}
                  className={`${styles.vendorItem} ${value === vendor.id ? styles.selected : ''}`}
                >
                  <span className={styles.vendorName}>{vendor.name}</span>
                  {vendor.email && (
                    <span className={styles.vendorEmail}>{vendor.email}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {filteredVendors.length === 0 && searchTerm.trim() && (
            <div className={styles.noResults}>
              No vendors found matching "{searchTerm}"
            </div>
          )}

          {/* Quick add option */}
          {searchTerm.trim() && !exactMatch && (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={isCreating}
              className={styles.quickAddButton}
            >
              {isCreating ? (
                'Adding...'
              ) : (
                <>
                  <span className={styles.quickAddIcon}>+</span>
                  Quick add "{searchTerm.trim()}"
                </>
              )}
            </button>
          )}

          {/* Add new vendor with full details */}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onCreateNew()
              }}
              className={styles.addNewButton}
            >
              <span className={styles.addNewIcon}>+</span>
              Add new vendor with details...
            </button>
          )}
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  )
}
