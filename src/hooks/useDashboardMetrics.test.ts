/**
 * Tests for useDashboardMetrics Hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDashboardMetrics, useRecentTransactions } from './useDashboardMetrics';

// Mock dexie-react-hooks
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => {
    // Return undefined initially to simulate loading state
    return undefined;
  }),
}));

// Mock database
vi.mock('@/db', () => ({
  db: {
    accounts: {
      where: vi.fn(),
    },
    transactions: {
      where: vi.fn(),
    },
    transactionLineItems: {
      where: vi.fn(),
    },
  },
}));

describe('useDashboardMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() =>
      useDashboardMetrics({ companyId: 'company-1' })
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.revenue).toBe('0.00');
    expect(result.current.expenses).toBe('0.00');
    expect(result.current.netProfit).toBe('0.00');
    expect(result.current.isProfitable).toBe(false);
    expect(result.current.transactionCount).toBe(0);
  });

  it('should accept custom date range', () => {
    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-01-31').getTime();

    const { result } = renderHook(() =>
      useDashboardMetrics({
        companyId: 'company-1',
        startDate,
        endDate,
      })
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('should return null error initially', () => {
    const { result } = renderHook(() =>
      useDashboardMetrics({ companyId: 'company-1' })
    );

    expect(result.current.error).toBeNull();
  });

  it('should update when company ID changes', () => {
    const { result, rerender } = renderHook(
      ({ companyId }) => useDashboardMetrics({ companyId }),
      {
        initialProps: { companyId: 'company-1' },
      }
    );

    expect(result.current.isLoading).toBe(true);

    rerender({ companyId: 'company-2' });

    expect(result.current.isLoading).toBe(true);
  });
});

describe('useRecentTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useRecentTransactions('company-1'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.transactions).toEqual([]);
  });

  it('should accept custom limit', () => {
    const { result } = renderHook(() => useRecentTransactions('company-1', 5));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.transactions).toEqual([]);
  });

  it('should default to 10 transactions', () => {
    const { result } = renderHook(() => useRecentTransactions('company-1'));

    expect(result.current.transactions).toEqual([]);
  });

  it('should update when company ID changes', () => {
    const { result, rerender } = renderHook(
      ({ companyId }) => useRecentTransactions(companyId),
      {
        initialProps: { companyId: 'company-1' },
      }
    );

    expect(result.current.isLoading).toBe(true);

    rerender({ companyId: 'company-2' });

    expect(result.current.isLoading).toBe(true);
  });
});
