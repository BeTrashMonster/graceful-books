/**
 * Backup Permissions Management Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 6, Task 6.7:
 * Admin interface for granting/revoking email backup permissions.
 *
 * Features:
 * - List all users with email backup toggle
 * - Grant/revoke permission per user
 * - Role-filtered backups for non-admins
 * - Save preferences to database
 * - Real-time permission updates
 *
 * Joy Engineering: "Control with clarity - transparency in permissions 🔐"
 */

import { useState, useEffect, useCallback } from 'react'
import type { User } from '../../store/types'
import { db } from '../../store/database'
import { Button } from '../core/Button'
import { Loading } from '../feedback/Loading'
import { ErrorMessage } from '../feedback/ErrorMessage'
import styles from './BackupPermissions.module.css'

/**
 * Backup permission for a user
 */
export interface BackupPermission {
  userId: string
  userName: string
  userEmail: string
  userRole: string
  hasEmailBackupPermission: boolean
  isRoleFiltered: boolean
  lastModified?: Date
}

/**
 * Backup Permissions Props
 */
export interface BackupPermissionsProps {
  /**
   * Company ID
   */
  companyId: string

  /**
   * Called when permissions are updated
   */
  onPermissionsUpdated?: () => void

  /**
   * Admin role check (default: true)
   */
  isAdmin?: boolean
}

/**
 * Backup Permissions Management Component
 *
 * Allows admins to grant/revoke email backup permissions for company users.
 * Non-admin users receive role-filtered backups (only data relevant to their role).
 *
 * @example
 * ```tsx
 * <BackupPermissions
 *   companyId="company-123"
 *   onPermissionsUpdated={() => console.log('Permissions updated')}
 * />
 * ```
 */
export function BackupPermissions({
  companyId,
  onPermissionsUpdated,
  isAdmin = true,
}: BackupPermissionsProps) {
  const [permissions, setPermissions] = useState<BackupPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Admin role check
  if (!isAdmin) {
    return (
      <div className={styles.accessDenied} role="alert">
        <h2>Access Restricted</h2>
        <p>
          This area is only available to administrators. If you need access to backup permissions
          management, please contact your system administrator.
        </p>
      </div>
    )
  }

  /**
   * Load backup permissions for all company users
   */
  const loadPermissions = useCallback(async () => {
    if (!companyId) {
      setError('Company ID is required to load permissions.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get all users for the company
      const users = await db.users
        .where('companyId')
        .equals(companyId)
        .toArray()

      // Build permission list
      const permissionsList: BackupPermission[] = users.map((user: User) => {
        // Determine if user has email backup permission
        // For now, stored in user.metadata
        const hasPermission =
          user.metadata &&
          typeof user.metadata === 'object' &&
          'hasEmailBackupPermission' in user.metadata
            ? Boolean((user.metadata as any).hasEmailBackupPermission)
            : false

        // Non-admin users get role-filtered backups
        const isRoleFiltered = user.role !== 'admin'

        // Last modified timestamp
        const lastModified =
          user.metadata &&
          typeof user.metadata === 'object' &&
          'emailBackupPermissionModified' in user.metadata
            ? new Date((user.metadata as any).emailBackupPermissionModified)
            : undefined

        return {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          hasEmailBackupPermission: hasPermission,
          isRoleFiltered,
          lastModified,
        }
      })

      // Sort: admins first, then by name
      permissionsList.sort((a, b) => {
        if (a.userRole === 'admin' && b.userRole !== 'admin') return -1
        if (a.userRole !== 'admin' && b.userRole === 'admin') return 1
        return a.userName.localeCompare(b.userName)
      })

      setPermissions(permissionsList)
    } catch (err) {
      console.error('Error loading backup permissions:', err)
      setError('We encountered an issue loading backup permissions. Please try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }, [companyId])

  // Load permissions on mount
  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  /**
   * Toggle email backup permission for a user
   */
  const togglePermission = async (userId: string, currentValue: boolean) => {
    setSavingUserId(userId)
    setError(null)
    setSuccessMessage(null)

    try {
      // Get user
      const user = await db.users.get(userId)

      if (!user) {
        throw new Error('User not found')
      }

      // Update permission in metadata
      const updatedMetadata = {
        ...(typeof user.metadata === 'object' ? user.metadata : {}),
        hasEmailBackupPermission: !currentValue,
        emailBackupPermissionModified: Date.now(),
      }

      // Save to database
      await db.users.update(userId, {
        metadata: updatedMetadata,
      })

      // Update local state
      setPermissions((prev) =>
        prev.map((perm) =>
          perm.userId === userId
            ? {
                ...perm,
                hasEmailBackupPermission: !currentValue,
                lastModified: new Date(),
              }
            : perm
        )
      )

      // Show success message
      const action = !currentValue ? 'granted' : 'revoked'
      setSuccessMessage(
        `Email backup permission ${action} for ${user.name}`
      )
      setTimeout(() => setSuccessMessage(null), 5000)

      // Notify parent
      if (onPermissionsUpdated) {
        onPermissionsUpdated()
      }
    } catch (err) {
      console.error('Error toggling permission:', err)
      setError('We had trouble updating the permission. Please try again.')
    } finally {
      setSavingUserId(null)
    }
  }

  /**
   * Grant permission to all users
   */
  const grantAll = async () => {
    setError(null)
    setSuccessMessage(null)

    const usersToUpdate = permissions.filter((p) => !p.hasEmailBackupPermission)

    if (usersToUpdate.length === 0) {
      setSuccessMessage('All users already have email backup permission')
      setTimeout(() => setSuccessMessage(null), 5000)
      return
    }

    setIsLoading(true)

    try {
      // Update all users
      for (const perm of usersToUpdate) {
        await togglePermission(perm.userId, false)
      }

      setSuccessMessage(
        `Granted email backup permission to ${usersToUpdate.length} user${usersToUpdate.length === 1 ? '' : 's'}`
      )
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      console.error('Error granting all permissions:', err)
      setError('We had trouble granting permissions to all users. Some changes may not have been saved.')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Revoke permission from all users
   */
  const revokeAll = async () => {
    if (
      !confirm(
        'Are you sure you want to revoke email backup permission from all users? This will prevent them from receiving email backups.'
      )
    ) {
      return
    }

    setError(null)
    setSuccessMessage(null)

    const usersToUpdate = permissions.filter((p) => p.hasEmailBackupPermission)

    if (usersToUpdate.length === 0) {
      setSuccessMessage('No users have email backup permission')
      setTimeout(() => setSuccessMessage(null), 5000)
      return
    }

    setIsLoading(true)

    try {
      // Update all users
      for (const perm of usersToUpdate) {
        await togglePermission(perm.userId, true)
      }

      setSuccessMessage(
        `Revoked email backup permission from ${usersToUpdate.length} user${usersToUpdate.length === 1 ? '' : 's'}`
      )
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      console.error('Error revoking all permissions:', err)
      setError('We had trouble revoking permissions from all users. Some changes may not have been saved.')
    } finally {
      setIsLoading(false)
    }
  }

  const permissionCount = permissions.filter((p) => p.hasEmailBackupPermission).length

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Backup Permissions</h1>
        <p className={styles.subtitle}>
          Control which users can receive email backups of company data.
          Non-admin users receive role-filtered backups containing only data relevant to their role.
        </p>
      </header>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{permissions.length}</div>
          <div className={styles.summaryLabel}>Total Users</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{permissionCount}</div>
          <div className={styles.summaryLabel}>With Email Backup</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{permissions.length - permissionCount}</div>
          <div className={styles.summaryLabel}>Without Email Backup</div>
        </div>
      </div>

      {/* Bulk actions */}
      <div className={styles.bulkActions}>
        <Button onClick={grantAll} variant="secondary" disabled={isLoading}>
          Grant All
        </Button>
        <Button onClick={revokeAll} variant="secondary" disabled={isLoading}>
          Revoke All
        </Button>
        <Button onClick={loadPermissions} variant="secondary" disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className={styles.successMessage} role="status">
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {/* Loading state */}
      {isLoading && <Loading message="Loading permissions..." />}

      {/* Permissions list */}
      {!isLoading && permissions.length === 0 && (
        <div className={styles.emptyState}>
          <p>No users found for this company.</p>
          <p>Add users to the company to manage their backup permissions.</p>
        </div>
      )}

      {!isLoading && permissions.length > 0 && (
        <div className={styles.permissionsTable}>
          <table role="table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Backup Type</th>
                <th scope="col">Email Backup Permission</th>
                <th scope="col">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm.userId}>
                  <td className={styles.userName}>{perm.userName}</td>
                  <td className={styles.userEmail}>{perm.userEmail}</td>
                  <td>
                    <span
                      className={styles.roleBadge}
                      data-role={perm.userRole}
                    >
                      {perm.userRole}
                    </span>
                  </td>
                  <td>
                    {perm.isRoleFiltered ? (
                      <span className={styles.backupType} title="Only data relevant to user's role">
                        Role-Filtered
                      </span>
                    ) : (
                      <span className={styles.backupType} title="Full company data backup">
                        Full Backup
                      </span>
                    )}
                  </td>
                  <td>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={perm.hasEmailBackupPermission}
                        onChange={() => togglePermission(perm.userId, perm.hasEmailBackupPermission)}
                        disabled={savingUserId === perm.userId}
                        aria-label={`Toggle email backup permission for ${perm.userName}`}
                      />
                      <span className={styles.toggleSlider}></span>
                      <span className={styles.toggleLabel}>
                        {savingUserId === perm.userId
                          ? 'Saving...'
                          : perm.hasEmailBackupPermission
                          ? 'Enabled'
                          : 'Disabled'}
                      </span>
                    </label>
                  </td>
                  <td className={styles.lastModified}>
                    {perm.lastModified
                      ? perm.lastModified.toLocaleString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
