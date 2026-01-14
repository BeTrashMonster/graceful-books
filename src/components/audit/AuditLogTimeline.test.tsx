/**
 * Audit Log Timeline Component Tests
 *
 * Integration tests for the timeline visualization component
 * Part of E7: Audit Log - Extended [MVP]
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuditLogTimeline } from './AuditLogTimeline';
import type { AuditLogTimeline as TimelineData } from '../../services/auditLogExtended';
import * as auditService from '../../services/auditLogExtended';
import { AuditAction, AuditEntityType } from '../../types/database.types';

// Mock the audit service
vi.mock('../../services/auditLogExtended');

describe('AuditLogTimeline Component', () => {
  const mockCompanyId = 'test-company';
  const mockDateFrom = new Date('2024-01-01');
  const mockDateTo = new Date('2024-01-31');

  const mockTimelineData: TimelineData = {
    entries: [
      {
        timestamp: Date.now(),
        date: '2024-01-15',
        count: 10,
        actions: [
          { action: AuditAction.CREATE, count: 5 },
          { action: AuditAction.UPDATE, count: 3 },
          { action: AuditAction.DELETE, count: 2 },
        ],
        entityTypes: [
          { type: AuditEntityType.TRANSACTION, count: 6 },
          { type: AuditEntityType.ACCOUNT, count: 4 },
        ],
        logs: [
          {
            id: 'log-1',
            company_id: mockCompanyId,
            user_id: 'user-1',
            entity_type: AuditEntityType.TRANSACTION,
            entity_id: 'entity-1',
            action: AuditAction.CREATE,
            before_value: null,
            after_value: '{"amount": 100}',
            changed_fields: ['amount'],
            ip_address: '192.168.1.1',
            device_id: 'device-1',
            user_agent: 'Browser',
            timestamp: Date.now(),
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
          },
        ],
      },
      {
        timestamp: Date.now() - 86400000,
        date: '2024-01-14',
        count: 15,
        actions: [
          { action: AuditAction.CREATE, count: 8 },
          { action: AuditAction.UPDATE, count: 7 },
        ],
        entityTypes: [
          { type: AuditEntityType.TRANSACTION, count: 10 },
          { type: AuditEntityType.CONTACT, count: 5 },
        ],
        logs: [],
      },
    ],
    totalLogs: 25,
    dateRange: {
      from: mockDateFrom,
      to: mockDateTo,
    },
    executionTimeMs: 150,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
  });

  it('should render timeline data when loaded', async () => {
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockResolvedValue(
      mockTimelineData
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Audit Log Timeline')).toBeInTheDocument();
    });

    expect(screen.getByText(/25 events/)).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    expect(screen.getByText('2024-01-14')).toBeInTheDocument();
  });

  it('should display error message on failure', async () => {
    const errorMessage = 'Failed to load timeline';
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockRejectedValue(
      new Error(errorMessage)
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Oops! Something unexpected happened')
      ).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should display empty state when no data', async () => {
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockResolvedValue({
      entries: [],
      totalLogs: 0,
      dateRange: { from: mockDateFrom, to: mockDateTo },
      executionTimeMs: 50,
    });

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('No audit log entries found for this date range.')
      ).toBeInTheDocument();
    });
  });

  it('should expand and collapse timeline entries', async () => {
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockResolvedValue(
      mockTimelineData
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });

    // Initially collapsed - details should not be visible
    expect(screen.queryByText('By Entity Type')).not.toBeInTheDocument();

    // Click to expand
    const entryButton = screen.getByText('2024-01-15').closest('button');
    if (entryButton) {
      fireEvent.click(entryButton);
    }

    // Should show details
    await waitFor(() => {
      expect(screen.getByText('By Entity Type')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    // Click again to collapse
    if (entryButton) {
      fireEvent.click(entryButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('By Entity Type')).not.toBeInTheDocument();
    });
  });

  it('should display action and entity type badges', async () => {
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockResolvedValue(
      mockTimelineData
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Created/)).toBeInTheDocument();
    });

    // Should show action counts in badges
    expect(screen.getByText(/Created \(5\)/)).toBeInTheDocument();
    expect(screen.getByText(/Updated \(3\)/)).toBeInTheDocument();
  });

  it('should show execution time', async () => {
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockResolvedValue(
      mockTimelineData
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('150ms')).toBeInTheDocument();
    });
  });

  it('should call onEntryClick when provided', async () => {
    const mockOnEntryClick = vi.fn();
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockResolvedValue(
      mockTimelineData
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
        onEntryClick={mockOnEntryClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });

    // Expand entry
    const entryButton = screen.getByText('2024-01-15').closest('button');
    if (entryButton) {
      fireEvent.click(entryButton);
    }

    await waitFor(() => {
      const viewDetailsButton = screen.getByText('View Details');
      fireEvent.click(viewDetailsButton);
    });

    expect(mockOnEntryClick).toHaveBeenCalledWith(mockTimelineData.entries[0]);
  });

  it('should support different grouping modes', async () => {
    const mockGenerateTimeline = vi.spyOn(
      auditService,
      'generateAuditLogTimeline'
    );
    mockGenerateTimeline.mockResolvedValue(mockTimelineData);

    const { rerender } = render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
        groupBy="day"
      />
    );

    await waitFor(() => {
      expect(mockGenerateTimeline).toHaveBeenCalledWith(
        mockCompanyId,
        mockDateFrom,
        mockDateTo,
        'day'
      );
    });

    // Change grouping
    rerender(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
        groupBy="hour"
      />
    );

    await waitFor(() => {
      expect(mockGenerateTimeline).toHaveBeenCalledWith(
        mockCompanyId,
        mockDateFrom,
        mockDateTo,
        'hour'
      );
    });
  });

  it('should be accessible', async () => {
    vi.spyOn(auditService, 'generateAuditLogTimeline').mockResolvedValue(
      mockTimelineData
    );

    render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    });

    // Check ARIA attributes
    const entryButton = screen.getByText('2024-01-15').closest('button');
    expect(entryButton).toHaveAttribute('aria-expanded', 'false');

    // Expand and check again
    if (entryButton) {
      fireEvent.click(entryButton);
    }

    await waitFor(() => {
      expect(entryButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('should reload data when props change', async () => {
    const mockGenerateTimeline = vi.spyOn(
      auditService,
      'generateAuditLogTimeline'
    );
    mockGenerateTimeline.mockResolvedValue(mockTimelineData);

    const { rerender } = render(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={mockDateTo}
      />
    );

    await waitFor(() => {
      expect(mockGenerateTimeline).toHaveBeenCalledTimes(1);
    });

    // Change date range
    const newDateTo = new Date('2024-02-29');
    rerender(
      <AuditLogTimeline
        companyId={mockCompanyId}
        dateFrom={mockDateFrom}
        dateTo={newDateTo}
      />
    );

    await waitFor(() => {
      expect(mockGenerateTimeline).toHaveBeenCalledTimes(2);
      expect(mockGenerateTimeline).toHaveBeenLastCalledWith(
        mockCompanyId,
        mockDateFrom,
        newDateTo,
        'day'
      );
    });
  });
});
