/**
 * Team Access Management Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 6, Task 6.1:
 * Admin dashboard for managing user access to company data.
 *
 * Features:
 * - List all users with roles
 * - Show last sync timestamp
 * - Revoke access button
 * - Confirmation modal with key rotation warning
 * - Historical export option
 *
 * Joy Engineering: "Complete control, complete transparency 🛡️"
 */

import { useState, useEffect } from 'react'
import { db } from '../../store/database'
import type { UserEntity } from '../../store/types'
import styles from './TeamAccessManagement.module.css'

/**
 * User access information with sync status
 */
interface UserAccessInfo extends UserEntity {
  /** Last sync timestamp (if synced) */
  lastSyncAt?: Date

  /** Whether user is currently online */
  isOnline?: boolean
}

/**
 * Revocation options
 */
interface RevocationOptions {
  /** User to revoke */
  userId: string

  /** User's name for confirmation */
  userName: string

  /** Whether to generate historical export */
  generateExport: boolean
}

/**
 * Team Access Management Props
 */
export interface TeamAccessManagementProps {
  /**
   * Company ID to manage users for
   */
  companyId: string

  /**
   * Called when user is revoked
   */
  onUserRevoked?: (userId: string, options: RevocationOptions) => Promise<void>

  /**
   * Whether the current user has admin permissions
   */
  isAdmin?: boolean
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date?: Date): string {
  if (!date) return 'Never'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}

/**
 * Get role badge color
 */
function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
      return styles.roleAdmin
    case 'manager':
      return styles.roleManager
    case 'bookkeeper':
      return styles.roleBookkeeper
    case 'view-only':
      return styles.roleViewOnly
    default:
      return ''
  }
}

/**
 * Format role for display
 */
function formatRole(role: string): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'manager':
      return 'Manager'
    case 'bookkeeper':
      return 'Bookkeeper'
    case 'view-only':
      return 'View Only'
    default:
      return role
  }
}

/**
 * Team Access Management Component
 *
 * Provides admins with tools to manage user access, view sync status,
 * and revoke access with key rotation.
 *
 * @example
 * ```tsx
 * <TeamAccessManagement
 *   companyId="company-123"
 *   onUserRevoked={handleUserRevoked}
 *   isAdmin={true}
 * />
 * ```
 */
export function TeamAccessManagement({
  companyId,
  onUserRevoked,
  isAdmin = false,
}: TeamAccessManagementProps) {
  const [users, setUsers] = useState<UserAccessInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revocationModal, setRevocationModal] = useState<{
    visible: boolean
    user: UserAccessInfo | null
    generateExport: boolean
    confirming: boolean
  }>({
    visible: false,
    user: null,
    generateExport: false,
    confirming: false,
  })

  // Load users
  useEffect(() => {
    loadUsers()
  }, [companyId])

  /**
   * Load all users for the company
   */
  async function loadUsers() {
    try {
      setLoading(true)
      setError(null)

      // Get all users for this company
      const allUsers = await db.users
        .where('companyId')
        .equals(companyId)
        .toArray()

      // TODO: Add lastSyncAt from sync service
      // For now, use lastLoginAt as a proxy
      const usersWithSync: UserAccessInfo[] = allUsers.map((user) => ({
        ...user,
        lastSyncAt: user.lastLoginAt,
        isOnline: false, // TODO: Check WebSocket connection status
      }))

      setUsers(usersWithSync)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError('Failed to load team members. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Open revocation confirmation modal
   */
  function openRevocationModal(user: UserAccessInfo) {
    setRevocationModal({
      visible: true,
      user,
      generateExport: false,
      confirming: false,
    })
  }

  /**
   * Close revocation modal
   */
  function closeRevocationModal() {
    setRevocationModal({
      visible: false,
      user: null,
      generateExport: false,
      confirming: false,
    })
  }

  /**
   * Handle revocation confirmation
   */
  async function handleConfirmRevocation() {
    if (!revocationModal.user || !onUserRevoked) return

    try {
      setRevocationModal((prev) => ({ ...prev, confirming: true }))

      await onUserRevoked(revocationModal.user.id, {
        userId: revocationModal.user.id,
        userName: revocationModal.user.name,
        generateExport: revocationModal.generateExport,
      })

      // Refresh user list
      await loadUsers()

      // Close modal
      closeRevocationModal()
    } catch (err) {
      console.error('Failed to revoke user:', err)
      setError('Failed to revoke user access. Please try again.')
      setRevocationModal((prev) => ({ ...prev, confirming: false }))
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} aria-label="Loading team members" />
          <p>Loading team members...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            ⚠️
          </span>
          {error}
          <button
            type="button"
            onClick={loadUsers}
            className={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (users.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            👥
          </span>
          <h3>No Team Members</h3>
          <p>Your team will appear here once you invite members.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Team Access Management</h2>
          <p className={styles.subtitle}>
            Complete control, complete transparency 🛡️
          </p>
        </div>
        <div className={styles.stats}>
          <span className={styles.statItem}>
            <strong>{users.length}</strong> Team Member
            {users.length === 1 ? '' : 's'}
          </span>
          <span className={styles.statItem}>
            <strong>{users.filter((u) => u.isOnline).length}</strong> Online
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table} role="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last Sync</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                {/* Name */}
                <td className={styles.nameCell}>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar} aria-hidden="true">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.userName}>{user.name}</span>
                  </div>
                </td>

                {/* Email */}
                <td className={styles.emailCell}>{user.email}</td>

                {/* Role */}
                <td>
                  <span
                    className={`${styles.roleBadge} ${getRoleBadgeClass(
                      user.role
                    )}`}
                  >
                    {formatRole(user.role)}
                  </span>
                </td>

                {/* Last Sync */}
                <td className={styles.syncCell}>
                  {formatTimestamp(user.lastSyncAt)}
                </td>

                {/* Status */}
                <td>
                  <span
                    className={`${styles.statusIndicator} ${
                      user.isOnline ? styles.statusOnline : styles.statusOffline
                    }`}
                  >
                    {user.isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>

                {/* Actions */}
                <td className={styles.actionsCell}>
                  {isAdmin && user.role !== 'admin' ? (
                    <button
                      type="button"
                      onClick={() => openRevocationModal(user)}
                      className={styles.revokeButton}
                      aria-label={`Revoke access for ${user.name}`}
                    >
                      Revoke Access
                    </button>
                  ) : (
                    <span className={styles.noAction}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revocation Confirmation Modal */}
      {revocationModal.visible && revocationModal.user && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="revocation-title"
        >
          <div className={styles.modal}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <h3 id="revocation-title" className={styles.modalTitle}>
                Revoke Access?
              </h3>
              <button
                type="button"
                onClick={closeRevocationModal}
                className={styles.modalClose}
                aria-label="Close modal"
                disabled={revocationModal.confirming}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              <div className={styles.warningBox} role="alert">
                <span className={styles.warningIcon} aria-hidden="true">
                  🔐
                </span>
                <p>
                  <strong>This will rotate encryption keys for security.</strong>
                  <br />
                  {revocationModal.user.name}'s access will end immediately.
                </p>
              </div>

              <div className={styles.userDetails}>
                <p>
                  <strong>User:</strong> {revocationModal.user.name}
                </p>
                <p>
                  <strong>Email:</strong> {revocationModal.user.email}
                </p>
                <p>
                  <strong>Role:</strong> {formatRole(revocationModal.user.role)}
                </p>
              </div>

              <label className={styles.exportCheckbox}>
                <input
                  type="checkbox"
                  checked={revocationModal.generateExport}
                  onChange={(e) =>
                    setRevocationModal((prev) => ({
                      ...prev,
                      generateExport: e.target.checked,
                    }))
                  }
                  disabled={revocationModal.confirming}
                />
                <span>Generate historical export for {revocationModal.user.name}</span>
              </label>

              <p className={styles.exportNote}>
                If checked, {revocationModal.user.name} will receive a read-only copy
                of the data they helped create. This is the right thing to do.
              </p>
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={closeRevocationModal}
                className={styles.cancelButton}
                disabled={revocationModal.confirming}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevocation}
                className={styles.confirmButton}
                disabled={revocationModal.confirming}
              >
                {revocationModal.confirming ? (
                  <>
                    <span className={styles.buttonSpinner} aria-hidden="true" />
                    Revoking...
                  </>
                ) : (
                  'Confirm Revocation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
