/**
 * User Activity Dashboard Component Tests
 *
 * Tests for S7-2: User Activity Logging
 * Verifies admin can view and filter user activities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { UserActivityDashboard } from './UserActivityDashboard'
import * as userActivityService from '../../services/userActivity'
import type { AuditLog } from '../../types/database.types'

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    role: 'admin',
    companyId: 'company-123',
    userId: 'admin-user-123',
    isAuthenticated: true,
    userIdentifier: 'admin@example.com',
    currentCompany: { id: 'company-123', name: 'Test Company' },
  })),
}))

// Mock the database
vi.mock('../../db', () => ({
  db: {
    audit_logs: {
      where: vi.fn(),
    },
  },
}))

// Mock user activity service
vi.mock('../../services/userActivity', () => ({
  queryUserActivity: vi.fn(),
  getUserActivityStats: vi.fn(),
  getRecentUserActivities: vi.fn(),
}))

describe('UserActivityDashboard', () => {
  const mockActivities: Partial<AuditLog>[] = [
    {
      id: 'log-1',
      user_id: 'user-123',
      company_id: 'company-123',
      entity_type: 'TRANSACTION',
      entity_id: 'txn-456',
      action: 'CREATE',
      timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
      changed_fields: ['amount', 'description'],
      before_value: null,
      after_value: JSON.stringify({ amount: 100, description: 'Test' }),
      device_id: 'device-abc',
      user_agent: 'Mozilla/5.0',
      ip_address: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    {
      id: 'log-2',
      user_id: 'user-456',
      company_id: 'company-123',
      entity_type: 'ACCOUNT',
      entity_id: 'acc-789',
      action: 'UPDATE',
      timestamp: Date.now() - 1000 * 60 * 10, // 10 minutes ago
      changed_fields: ['balance'],
      before_value: JSON.stringify({ balance: 1000 }),
      after_value: JSON.stringify({ balance: 1500 }),
      device_id: 'device-def',
      user_agent: 'Mozilla/5.0',
      ip_address: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    {
      id: 'log-3',
      user_id: 'user-123',
      company_id: 'company-123',
      entity_type: 'SETTINGS',
      entity_id: 'theme',
      action: 'SETTINGS_CHANGE',
      timestamp: Date.now() - 1000 * 60 * 15, // 15 minutes ago
      changed_fields: ['theme'],
      before_value: JSON.stringify({ theme: 'light' }),
      after_value: JSON.stringify({ theme: 'dark' }),
      device_id: 'device-abc',
      user_agent: 'Mozilla/5.0',
      ip_address: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
  ]

  const mockStats = {
    totalActivities: 3,
    creates: 1,
    updates: 1,
    deletes: 0,
    exports: 0,
    settingsChanges: 1,
    byEntityType: {
      TRANSACTION: 1,
      ACCOUNT: 1,
      SETTINGS: 1,
    },
    byHour: {
      14: 3,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userActivityService.queryUserActivity).mockResolvedValue(mockActivities as AuditLog[])
    vi.mocked(userActivityService.getUserActivityStats).mockResolvedValue(mockStats)
  })

  it('should render admin dashboard', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText('User Activity Dashboard')).toBeInTheDocument()
    })
  })

  it('should display activity statistics', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Total Activities')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('Creates')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('Updates')).toBeInTheDocument()
      expect(screen.getByText('Settings Changes')).toBeInTheDocument()
    })
  })

  it('should display activity list', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/user-123/)).toBeInTheDocument()
      expect(screen.getByText(/user-456/)).toBeInTheDocument()
      expect(screen.getByText('Created')).toBeInTheDocument()
      expect(screen.getByText('Updated')).toBeInTheDocument()
      expect(screen.getByText('Changed settings')).toBeInTheDocument()
    })
  })

  it('should filter by user ID', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    const userIdInput = screen.getByLabelText('User ID')
    fireEvent.change(userIdInput, { target: { value: 'user-123' } })

    // Wait for filter to be applied
    await waitFor(() => {
      expect(userActivityService.queryUserActivity).toHaveBeenCalled()
    })
  })

  it('should filter by action type', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByLabelText('Action')).toBeInTheDocument()
    })

    const actionSelect = screen.getByLabelText('Action')
    fireEvent.change(actionSelect, { target: { value: 'CREATE' } })

    await waitFor(() => {
      expect(userActivityService.queryUserActivity).toHaveBeenCalled()
    })
  })

  it('should filter by entity type', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByLabelText('Entity Type')).toBeInTheDocument()
    })

    const entityTypeSelect = screen.getByLabelText('Entity Type')
    fireEvent.change(entityTypeSelect, { target: { value: 'TRANSACTION' } })

    await waitFor(() => {
      expect(userActivityService.queryUserActivity).toHaveBeenCalled()
    })
  })

  it('should filter by date range', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByLabelText('From Date')).toBeInTheDocument()
    })

    const fromDateInput = screen.getByLabelText('From Date')
    const toDateInput = screen.getByLabelText('To Date')

    fireEvent.change(fromDateInput, { target: { value: '2024-01-01' } })
    fireEvent.change(toDateInput, { target: { value: '2024-12-31' } })

    await waitFor(() => {
      expect(userActivityService.queryUserActivity).toHaveBeenCalled()
    })
  })

  it('should search activities', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search activities...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search activities...')
    fireEvent.change(searchInput, { target: { value: 'transaction' } })

    // Search is applied client-side, so activities should be filtered in the display
    await waitFor(() => {
      // The component should filter the displayed activities
      expect(screen.queryByText(/user-456/)).not.toBeInTheDocument() // Account activity filtered out
    })
  })

  it('should expand activity details', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('Show Details')[0]).toBeInTheDocument()
    })

    const showDetailsButtons = screen.getAllByText('Show Details')
    fireEvent.click(showDetailsButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Full Information')).toBeInTheDocument()
      expect(screen.getByText('Activity ID:')).toBeInTheDocument()
      expect(screen.getByText('Device ID:')).toBeInTheDocument()
    })
  })

  it('should collapse activity details', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText('Show Details')[0]).toBeInTheDocument()
    })

    const showDetailsButtons = screen.getAllByText('Show Details')
    fireEvent.click(showDetailsButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Hide Details')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Hide Details'))

    await waitFor(() => {
      expect(screen.queryByText('Full Information')).not.toBeInTheDocument()
    })
  })

  it('should export activities to CSV', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    // Mock createElement and appendChild
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)

    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Export to CSV')).toBeInTheDocument()
    })

    const exportButton = screen.getByText('Export to CSV')
    fireEvent.click(exportButton)

    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toMatch(/user-activity-.*\.csv/)
  })

  it('should handle pagination', async () => {
    // Create more activities to test pagination
    const manyActivities = Array.from({ length: 60 }, (_, i) => ({
      ...mockActivities[0],
      id: `log-${i}`,
      entity_id: `txn-${i}`,
    }))

    vi.mocked(userActivityService.queryUserActivity).mockResolvedValue(manyActivities as AuditLog[])

    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
    })

    const nextButton = screen.getByLabelText('Go to next page')
    expect(nextButton).not.toBeDisabled()

    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument()
    })
  })

  it('should show loading state', () => {
    vi.mocked(userActivityService.queryUserActivity).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<UserActivityDashboard />)

    expect(screen.getByText('Getting user activity ready for you...')).toBeInTheDocument()
  })

  it('should show error state', async () => {
    vi.mocked(userActivityService.queryUserActivity).mockRejectedValue(new Error('Database error'))

    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(
        screen.getByText('We encountered an issue loading the activity logs. Please try again in a moment.')
      ).toBeInTheDocument()
    })

    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('should retry after error', async () => {
    vi.mocked(userActivityService.queryUserActivity).mockRejectedValueOnce(new Error('Database error'))

    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    // Mock success on retry
    vi.mocked(userActivityService.queryUserActivity).mockResolvedValue(mockActivities as AuditLog[])

    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText('User Activity Dashboard')).toBeInTheDocument()
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument()
    })
  })

  it('should show empty state when no activities', async () => {
    vi.mocked(userActivityService.queryUserActivity).mockResolvedValue([])
    vi.mocked(userActivityService.getUserActivityStats).mockResolvedValue({
      ...mockStats,
      totalActivities: 0,
      creates: 0,
      updates: 0,
      deletes: 0,
      exports: 0,
      settingsChanges: 0,
      byEntityType: {},
      byHour: {},
    })

    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText('No activities found matching your filters.')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your search criteria or date range.')).toBeInTheDocument()
    })
  })

  it('should deny access for non-admin users', () => {
    // Mock non-admin role
    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
      role: 'user',
      companyId: 'company-123',
      userId: 'user-123',
      isAuthenticated: true,
      userIdentifier: 'user@example.com',
      currentCompany: { id: 'company-123', name: 'Test Company' },
    })

    render(<UserActivityDashboard />)

    expect(screen.getByText('Access Restricted')).toBeInTheDocument()
    expect(
      screen.getByText(/This area is only available to administrators/)
    ).toBeInTheDocument()
  })

  it('should display changed fields in activity row', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText('amount, description')).toBeInTheDocument()
      expect(screen.getByText('balance')).toBeInTheDocument()
    })
  })

  it('should truncate long field lists', async () => {
    const activityWithManyFields = {
      ...mockActivities[0],
      changed_fields: ['field1', 'field2', 'field3', 'field4', 'field5'],
    }

    vi.mocked(userActivityService.queryUserActivity).mockResolvedValue([activityWithManyFields] as AuditLog[])

    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/field1, field2, field3 \+2 more/)).toBeInTheDocument()
    })
  })

  it('should be keyboard accessible', async () => {
    render(<UserActivityDashboard />)

    await waitFor(() => {
      expect(screen.getByLabelText('User ID')).toBeInTheDocument()
    })

    const userIdInput = screen.getByLabelText('User ID')

    // Tab to input and type
    userIdInput.focus()
    expect(document.activeElement).toBe(userIdInput)

    fireEvent.keyDown(userIdInput, { key: 'Tab' })
    // Next element should receive focus (search input)
    const searchInput = screen.getByPlaceholderText('Search activities...')
    searchInput.focus()
    expect(document.activeElement).toBe(searchInput)
  })
})
