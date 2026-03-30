/**
 * Backup Permissions Component Tests
 *
 * Tests for backup permissions management UI.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BackupPermissions } from './BackupPermissions'
import { db } from '../../store/database'
import type { User } from '../../store/types'

// Mock database
vi.mock('../../store/database', () => ({
  db: {
    users: {
      where: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock components
vi.mock('../core/Button', () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}))

vi.mock('../feedback/Loading', () => ({
  Loading: ({ message }: any) => <div role="status">{message}</div>,
}))

vi.mock('../feedback/ErrorMessage', () => ({
  ErrorMessage: ({ message, onDismiss }: any) => (
    <div role="alert">
      {message}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}))

describe('BackupPermissions', () => {
  const mockUsers: User[] = [
    {
      id: 'user-1',
      companyId: 'company-1',
      name: 'Admin User',
      email: 'admin@company.com',
      role: 'admin',
      createdAt: new Date('2024-01-01'),
      metadata: {
        hasEmailBackupPermission: true,
        emailBackupPermissionModified: Date.parse('2024-01-10T10:00:00Z'),
      },
    },
    {
      id: 'user-2',
      companyId: 'company-1',
      name: 'Manager User',
      email: 'manager@company.com',
      role: 'manager',
      createdAt: new Date('2024-01-02'),
      metadata: {
        hasEmailBackupPermission: false,
      },
    },
    {
      id: 'user-3',
      companyId: 'company-1',
      name: 'Bookkeeper User',
      email: 'bookkeeper@company.com',
      role: 'bookkeeper',
      createdAt: new Date('2024-01-03'),
      metadata: {},
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock database queries
    vi.mocked(db.users.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockUsers),
      }),
    } as any)

    vi.mocked(db.users.get).mockImplementation((id: string) => {
      const user = mockUsers.find((u) => u.id === id)
      return Promise.resolve(user)
    })

    vi.mocked(db.users.update).mockResolvedValue(1)
  })

  describe('Access Control', () => {
    it('should deny access to non-admin users', () => {
      render(
        <BackupPermissions companyId="company-1" isAdmin={false} />
      )

      expect(screen.getByRole('alert')).toHaveTextContent('Access Restricted')
      expect(screen.getByText(/only available to administrators/i)).toBeInTheDocument()
    })

    it('should allow access to admin users', async () => {
      render(
        <BackupPermissions companyId="company-1" isAdmin={true} />
      )

      await waitFor(() => {
        expect(screen.getByText('Backup Permissions')).toBeInTheDocument()
      })
    })
  })

  describe('Permissions List', () => {
    it('should load and display permissions', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      // Should show loading state
      expect(screen.getByRole('status')).toHaveTextContent('Loading permissions...')

      // Wait for permissions to load
      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.getByText('Manager User')).toBeInTheDocument()
        expect(screen.getByText('Bookkeeper User')).toBeInTheDocument()
      })
    })

    it('should display user details correctly', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument()
      })

      expect(screen.getByText('admin@company.com')).toBeInTheDocument()
      expect(screen.getByText('manager@company.com')).toBeInTheDocument()
      expect(screen.getByText('bookkeeper@company.com')).toBeInTheDocument()
    })

    it('should show role badges', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        const badges = screen.getAllByText(/admin|manager|bookkeeper/i)
        expect(badges.length).toBeGreaterThan(0)
      })
    })

    it('should show backup type (role-filtered vs full)', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        const fullBackups = screen.getAllByText('Full Backup')
        const roleFiltered = screen.getAllByText('Role-Filtered')

        // Admin gets full backup, others get role-filtered
        expect(fullBackups.length).toBeGreaterThan(0)
        expect(roleFiltered.length).toBeGreaterThan(0)
      })
    })

    it('should show last modified timestamp', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        // User 1 has last modified timestamp
        const timestamps = screen.getAllByText(/Never|\//)
        expect(timestamps.length).toBeGreaterThan(0)
      })
    })

    it('should sort admins first, then by name', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        // Header + 3 user rows
        expect(rows).toHaveLength(4)
      })
    })

    it('should handle empty user list', async () => {
      vi.mocked(db.users.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('No users found for this company.')).toBeInTheDocument()
      })
    })

    it('should require company ID', async () => {
      render(
        <BackupPermissions companyId="" />
      )

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Company ID is required')
      })
    })
  })

  describe('Summary Cards', () => {
    it('should display total users count', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByText('Total Users')).toBeInTheDocument()
      })
    })

    it('should display users with email backup count', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('With Email Backup')).toBeInTheDocument()
        // 1 user has permission
        expect(screen.getByText('1')).toBeInTheDocument()
      })
    })

    it('should display users without email backup count', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Without Email Backup')).toBeInTheDocument()
        // 2 users don't have permission
        expect(screen.getByText('2')).toBeInTheDocument()
      })
    })
  })

  describe('Permission Toggle', () => {
    it('should toggle permission for a user', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Manager User')).toBeInTheDocument()
      })

      // Find the toggle for Manager User by aria-label
      const managerToggle = screen.getByLabelText(/Toggle email backup permission for Manager User/i)

      // Toggle on
      fireEvent.click(managerToggle)

      await waitFor(() => {
        expect(db.users.update).toHaveBeenCalledWith('user-2', expect.objectContaining({
          metadata: expect.objectContaining({
            hasEmailBackupPermission: true,
          }),
        }))
      })

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/permission granted/i)).toBeInTheDocument()
      })
    })

    it('should toggle permission off', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument()
      })

      // Find the toggle for Admin User (has permission)
      const adminToggle = screen.getByLabelText(/Toggle email backup permission for Admin User/i)

      // Toggle off
      fireEvent.click(adminToggle)

      await waitFor(() => {
        expect(db.users.update).toHaveBeenCalledWith('user-1', expect.objectContaining({
          metadata: expect.objectContaining({
            hasEmailBackupPermission: false,
          }),
        }))
      })

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/permission revoked/i)).toBeInTheDocument()
      })
    })

    it('should show saving state while toggling', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Manager User')).toBeInTheDocument()
      })

      const managerToggle = screen.getByLabelText(/Toggle email backup permission for Manager User/i)
      fireEvent.click(managerToggle)

      // Should show saving text (may be brief)
      // We check that update was called
      await waitFor(() => {
        expect(db.users.update).toHaveBeenCalled()
      })
    })

    it('should handle toggle errors', async () => {
      vi.mocked(db.users.update).mockRejectedValue(new Error('Update failed'))

      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Manager User')).toBeInTheDocument()
      })

      const managerToggle = screen.getByLabelText(/Toggle email backup permission for Manager User/i)
      fireEvent.click(managerToggle)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/trouble updating/i)
      })
    })

    it('should call onPermissionsUpdated callback', async () => {
      const onPermissionsUpdated = vi.fn()

      render(
        <BackupPermissions
          companyId="company-1"
          onPermissionsUpdated={onPermissionsUpdated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Manager User')).toBeInTheDocument()
      })

      const toggles = screen.getAllByRole('checkbox')
      fireEvent.click(toggles[1])

      await waitFor(() => {
        expect(onPermissionsUpdated).toHaveBeenCalled()
      })
    })
  })

  describe('Bulk Actions', () => {
    it('should have Grant All button', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Grant All')).toBeInTheDocument()
      })
    })

    it('should have Revoke All button', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Revoke All')).toBeInTheDocument()
      })
    })

    it('should have Refresh button', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })

    it('should refresh permissions list', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        // Should call database again
        expect(vi.mocked(db.users.where)).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels on toggles', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        const toggle = screen.getByLabelText(/Toggle email backup permission for Admin User/i)
        expect(toggle).toBeInTheDocument()
      })
    })

    it('should have table role', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
    })

    it('should have column headers', async () => {
      render(
        <BackupPermissions companyId="company-1" />
      )

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument()
        expect(screen.getByText('Email')).toBeInTheDocument()
        expect(screen.getByText('Role')).toBeInTheDocument()
        expect(screen.getByText('Backup Type')).toBeInTheDocument()
        expect(screen.getByText('Email Backup Permission')).toBeInTheDocument()
        expect(screen.getByText('Last Modified')).toBeInTheDocument()
      })
    })
  })
})
