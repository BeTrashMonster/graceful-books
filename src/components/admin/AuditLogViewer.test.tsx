/**
 * AuditLogViewer Component Tests
 *
 * Tests for the admin audit log viewer component.
 * Covers filtering, pagination, CSV export, and accessibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditLogViewer } from './AuditLogViewer'
import type { AuditLog } from '../../types/database.types'
import * as securityLogger from '../../utils/securityLogger'
import * as authContext from '../../contexts/AuthContext'

// Mock dependencies
vi.mock('../../db', () => ({
  db: {
    auditLogs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
    },
  },
}))

vi.mock('../../utils/securityLogger', () => ({
  querySecurityEvents: vi.fn(),
  getSecurityEventStats: vi.fn(),
  SecurityEventType: {
    FAILED_LOGIN: 'FAILED_LOGIN',
    AUTHORIZATION_FAILURE: 'AUTHORIZATION_FAILURE',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    ACCOUNT_LOCKOUT: 'ACCOUNT_LOCKOUT',
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Sample audit log data
const createMockAuditLog = (overrides = {}): AuditLog => ({
  id: 'log-1',
  company_id: 'company-1',
  user_id: 'user-1',
  entity_type: 'SECURITY' as any,
  entity_id: 'event-1',
  action: 'FAILED_LOGIN' as any,
  before_value: null,
  after_value: JSON.stringify({
    email: 'user@example.com',
    reason: 'invalid_credentials',
    attemptCount: 3,
  }),
  changed_fields: [],
  ip_address: '192.168.1.100',
  device_id: 'device-1',
  user_agent: 'Mozilla/5.0',
  timestamp: Date.now(),
  created_at: Date.now(),
  updated_at: Date.now(),
  deleted_at: null,
  ...overrides,
})

describe('AuditLogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock auth as admin by default
    vi.mocked(authContext.useAuth).mockReturnValue({
      role: 'admin',
      companyId: 'company-1',
      isAuthenticated: true,
      userIdentifier: 'admin@example.com',
      currentCompany: { id: 'company-1', name: 'Test Company' },
      deviceId: 'device-1',
      isLoading: false,
    })

    // Mock security logger functions
    vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue([])
    vi.mocked(securityLogger.getSecurityEventStats).mockResolvedValue({
      totalEvents: 0,
      failedLogins: 0,
      authorizationFailures: 0,
      rateLimitExceeded: 0,
      suspiciousActivity: 0,
      accountLockouts: 0,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Access Control', () => {
    it('should deny access to non-admin users', () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        role: 'user',
        companyId: 'company-1',
        isAuthenticated: true,
        userIdentifier: 'user@example.com',
        currentCompany: { id: 'company-1', name: 'Test Company' },
        deviceId: 'device-1',
        isLoading: false,
      })

      render(<AuditLogViewer />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument()
      expect(screen.getByText(/only available to administrators/i)).toBeInTheDocument()
    })

    it('should allow access to admin users', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Security Audit Log Viewer/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading and Display', () => {
    it('should display loading state initially', () => {
      render(<AuditLogViewer />)

      expect(screen.getByText(/Loading audit logs/i)).toBeInTheDocument()
    })

    it('should display empty state when no logs found', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/No audit logs found/i)).toBeInTheDocument()
      })
    })

    it('should display logs when data is available', async () => {
      const mockLogs = [
        createMockAuditLog({ id: 'log-1', action: 'FAILED_LOGIN' as any }),
        createMockAuditLog({ id: 'log-2', action: 'AUTHORIZATION_FAILURE' as any }),
      ]

      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      // Check that table headers are present
      const table = screen.getByRole('table')
      expect(within(table).getByText(/Date\/Time/i)).toBeInTheDocument()
      expect(within(table).getByText(/Entity Type/i)).toBeInTheDocument()
      expect(within(table).getAllByText(/Action/i)[0]).toBeInTheDocument()
    })
  })

  describe('Statistics Dashboard', () => {
    it('should display security statistics', async () => {
      vi.mocked(securityLogger.getSecurityEventStats).mockResolvedValue({
        totalEvents: 150,
        failedLogins: 25,
        authorizationFailures: 10,
        rateLimitExceeded: 5,
        suspiciousActivity: 2,
        accountLockouts: 1,
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument()
        expect(screen.getByText('25')).toBeInTheDocument()
        expect(screen.getByText('10')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
      })

      expect(screen.getByText(/Total Events \(24h\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Failed Logins/i)).toBeInTheDocument()
      expect(screen.getByText(/Authorization Failures/i)).toBeInTheDocument()
    })
  })

  describe('Filtering', () => {
    it('should allow filtering by company ID', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Company ID/i)).toBeInTheDocument()
      })

      const companyInput = screen.getByLabelText(/Company ID/i)
      await user.clear(companyInput)
      await user.type(companyInput, 'company-2')

      const applyButton = screen.getByRole('button', { name: /Apply Filters/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(securityLogger.querySecurityEvents).toHaveBeenCalledWith(
          'company-2',
          expect.anything(),
          expect.anything()
        )
      })
    })

    it('should allow filtering by event type', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Event Type/i)).toBeInTheDocument()
      })

      const eventTypeSelect = screen.getByLabelText(/Event Type/i)
      await user.selectOptions(eventTypeSelect, 'FAILED_LOGIN')

      const applyButton = screen.getByRole('button', { name: /Apply Filters/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(securityLogger.querySecurityEvents).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            eventType: 'FAILED_LOGIN',
          })
        )
      })
    })

    it('should allow filtering by user ID', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/User ID/i)).toBeInTheDocument()
      })

      const userInput = screen.getByLabelText(/User ID/i)
      await user.type(userInput, 'user-123')

      const applyButton = screen.getByRole('button', { name: /Apply Filters/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(securityLogger.querySecurityEvents).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            userId: 'user-123',
          })
        )
      })
    })

    it('should allow filtering by date range', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Date From/i)).toBeInTheDocument()
      })

      const dateFromInput = screen.getByLabelText(/Date From/i)
      const dateToInput = screen.getByLabelText(/Date To/i)

      await user.type(dateFromInput, '2024-01-01')
      await user.type(dateToInput, '2024-01-31')

      const applyButton = screen.getByRole('button', { name: /Apply Filters/i })
      await user.click(applyButton)

      await waitFor(() => {
        expect(securityLogger.querySecurityEvents).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            dateFrom: expect.any(Number),
            dateTo: expect.any(Number),
          })
        )
      })
    })

    it('should clear all filters when Clear Filters is clicked', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/User ID/i)).toBeInTheDocument()
      })

      // Set some filters
      const userInput = screen.getByLabelText(/User ID/i)
      await user.type(userInput, 'user-123')

      const dateFromInput = screen.getByLabelText(/Date From/i)
      await user.type(dateFromInput, '2024-01-01')

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /Clear Filters/i })
      await user.click(clearButton)

      expect(userInput).toHaveValue('')
      expect(dateFromInput).toHaveValue('')
    })
  })

  describe('Pagination', () => {
    const createMockLogs = (count: number): AuditLog[] => {
      return Array.from({ length: count }, (_, i) =>
        createMockAuditLog({ id: `log-${i}` })
      )
    }

    it('should paginate large result sets', async () => {
      const mockLogs = createMockLogs(150)
      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Showing 50 of 150 logs/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument()
    })

    it('should navigate to next page', async () => {
      const user = userEvent.setup()
      const mockLogs = createMockLogs(150)
      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument()
      })

      const nextButton = screen.getByRole('button', { name: /Go to next page/i })
      await user.click(nextButton)

      expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument()
    })

    it('should navigate to previous page', async () => {
      const user = userEvent.setup()
      const mockLogs = createMockLogs(150)
      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument()
      })

      // Go to next page first
      const nextButton = screen.getByRole('button', { name: /Go to next page/i })
      await user.click(nextButton)

      // Then go back
      const prevButton = screen.getByRole('button', { name: /Go to previous page/i })
      await user.click(prevButton)

      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument()
    })

    it('should change page size', async () => {
      const user = userEvent.setup()
      const mockLogs = createMockLogs(150)
      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Showing 50 of 150 logs/i)).toBeInTheDocument()
      })

      const pageSizeSelect = screen.getByLabelText(/Rows per page/i)
      await user.selectOptions(pageSizeSelect, '100')

      await waitFor(() => {
        expect(screen.getByText(/Showing 100 of 150 logs/i)).toBeInTheDocument()
      })
    })
  })

  describe('CSV Export', () => {
    it('should export logs to CSV', async () => {
      const user = userEvent.setup()
      const mockLogs = [
        createMockAuditLog({ id: 'log-1', action: 'FAILED_LOGIN' as any }),
        createMockAuditLog({ id: 'log-2', action: 'AUTHORIZATION_FAILURE' as any }),
      ]

      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      // Mock URL.createObjectURL and download
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
      const mockRevokeObjectURL = vi.fn()
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Export to CSV/i })).toBeInTheDocument()
      })

      const exportButton = screen.getByRole('button', { name: /Export to CSV/i })
      await user.click(exportButton)

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })

    it('should disable export button when no logs available', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Export to CSV/i })).toBeInTheDocument()
      })

      const exportButton = screen.getByRole('button', { name: /Export to CSV/i })
      expect(exportButton).toBeDisabled()
    })
  })

  describe('Auto-refresh', () => {
    it('should have auto-refresh checkbox enabled by default', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Auto-refresh logs every 30 seconds/i)).toBeInTheDocument()
      })

      const checkbox = screen.getByLabelText(/Auto-refresh logs every 30 seconds/i) as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('should toggle auto-refresh when checkbox is clicked', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Auto-refresh logs every 30 seconds/i)).toBeInTheDocument()
      })

      const checkbox = screen.getByLabelText(/Auto-refresh logs every 30 seconds/i) as HTMLInputElement
      expect(checkbox.checked).toBe(true)

      // Disable auto-refresh
      await user.click(checkbox)
      expect(checkbox.checked).toBe(false)

      // Enable again
      await user.click(checkbox)
      expect(checkbox.checked).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Company ID/i)).toBeInTheDocument()
      })

      expect(screen.getByLabelText(/Event Type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/User ID/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Date From/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Date To/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Auto-refresh logs every 30 seconds/i)).toBeInTheDocument()
    })

    it('should have keyboard navigable table', async () => {
      const mockLogs = [createMockAuditLog()]
      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })

      const table = screen.getByRole('table')
      expect(table).toHaveAttribute('role', 'table')
    })

    it('should have accessible pagination controls', async () => {
      const mockLogs = Array.from({ length: 100 }, (_, i) =>
        createMockAuditLog({ id: `log-${i}` })
      )
      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue(mockLogs)

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to first page/i })).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /Go to previous page/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Go to next page/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Go to last page/i })).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when loading fails', async () => {
      vi.mocked(securityLogger.querySecurityEvents).mockRejectedValue(
        new Error('Database error')
      )

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/encountered an issue loading/i)).toBeInTheDocument()
      })
    })

    it('should display error when company ID is missing', async () => {
      vi.mocked(authContext.useAuth).mockReturnValue({
        role: 'admin',
        companyId: null,
        isAuthenticated: true,
        userIdentifier: 'admin@example.com',
        currentCompany: null,
        deviceId: 'device-1',
        isLoading: false,
      })

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/Please select a company/i)).toBeInTheDocument()
      })
    })
  })

  describe('Event Details', () => {
    it('should expand and show event details when clicked', async () => {
      const user = userEvent.setup()
      const mockLog = createMockAuditLog({
        after_value: JSON.stringify({
          email: 'test@example.com',
          reason: 'invalid_credentials',
        }),
      })

      vi.mocked(securityLogger.querySecurityEvents).mockResolvedValue([mockLog])

      render(<AuditLogViewer />)

      await waitFor(() => {
        expect(screen.getByText(/View Details/i)).toBeInTheDocument()
      })

      const detailsButton = screen.getByText(/View Details/i)
      await user.click(detailsButton)

      await waitFor(() => {
        expect(screen.getByText(/test@example\.com/i)).toBeInTheDocument()
      })
    })
  })
})
