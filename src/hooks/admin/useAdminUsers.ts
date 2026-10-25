/**
 * useAdminUsers Hook
 *
 * Fetches and manages the admin user list with filters and pagination.
 * Calls the backend admin API endpoints.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_URL } from '../../config/api';
import type { UserFilters } from '../../components/admin/users/UserFilterBar';
import type { UserRowData, UserStatusBadge } from '../../components/admin/users/UserRow';

export interface FilterOptions {
  products: Array<{ slug: string; name: string }>;
  workshops: Array<{ id: string; name: string }>;
  tags: Array<{ tag: string; userCount: number }>;
}

export interface UseAdminUsersOptions {
  initialFilters?: Partial<UserFilters>;
  pageSize?: number;
}

export interface UseAdminUsersReturn {
  users: UserRowData[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  filterOptions: FilterOptions;
  filters: UserFilters;
  setFilters: (filters: UserFilters) => void;
  setPage: (page: number) => void;
  refresh: () => void;
}

const DEFAULT_FILTERS: UserFilters = {
  search: '',
  product: '',
  workshop: '',
  status: '',
  isBeta: false,
  needsAttention: false,
  emailSuppressed: false,
  tag: '',
};

/**
 * Transform backend user data to UserRowData format
 */
function transformUser(user: Record<string, unknown>): UserRowData {
  const statusBadge = user.statusBadge as UserStatusBadge | undefined;

  return {
    id: String(user.id),
    email: String(user.email),
    firstName: user.firstName as string | null,
    lastName: user.lastName as string | null,
    companyName: user.companyName as string | null,
    supportKey: String(user.supportKey),
    productSlug: String(user.productSlug),
    productName: String(user.productName || user.productSlug),
    createdAt: String(user.createdAt),
    lastLoginAt: user.lastLoginAt as string | null,
    isBeta: Boolean(user.isBeta),
    needsAttention: Boolean(user.needsAttention),
    statusBadge: statusBadge || {
      label: 'ACTIVE',
      variant: 'success',
    },
    workshops: Array.isArray(user.workshops)
      ? (user.workshops as Array<Record<string, unknown>>).map((w) => ({
          id: String(w.id),
          shortName: String(w.shortName),
          cohortName: String(w.cohortName),
        }))
      : [],
    tags: Array.isArray(user.tags) ? (user.tags as string[]) : [],
  };
}

export function useAdminUsers(options: UseAdminUsersOptions = {}): UseAdminUsersReturn {
  const { initialFilters, pageSize = 25 } = options;

  const [users, setUsers] = useState<UserRowData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    products: [],
    workshops: [],
    tags: [],
  });
  const [filters, setFilters] = useState<UserFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  // Get admin session from sessionStorage
  const getSession = useCallback(() => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    return sessionData ? JSON.parse(sessionData) : null;
  }, []);

  const totalPages = useMemo(
    () => Math.ceil(totalCount / pageSize),
    [totalCount, pageSize]
  );

  // Build query string from filters
  const buildQueryString = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      if (filters.search) params.set('search', filters.search);
      if (filters.product) params.set('product', filters.product);
      if (filters.workshop) params.set('workshop', filters.workshop);
      if (filters.status) params.set('status', filters.status);
      if (filters.isBeta) params.set('isBeta', 'true');
      if (filters.needsAttention) params.set('needsAttention', 'true');
      if (filters.emailSuppressed) params.set('emailSuppressed', 'true');
      if (filters.tag) params.set('tag', filters.tag);

      return params.toString();
    },
    [filters, pageSize]
  );

  // Fetch filter options (once on mount)
  const fetchFilterOptions = useCallback(async () => {
    const session = getSession();
    if (!session?.token) return;

    try {
      const response = await fetch(`${API_URL}/admin/filter-options`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setFilterOptions(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  }, [getSession]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    const session = getSession();
    if (!session?.token) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString(currentPage);
      const response = await fetch(`${API_URL}/admin/users?${queryString}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      // Handle both wrapped and unwrapped response formats
      const usersData = data.data?.users || data.users || [];
      const total = data.data?.total || data.total || 0;

      setUsers(usersData.map(transformUser));
      setTotalCount(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setUsers([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [buildQueryString, currentPage, getSession]);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Fetch on mount and when filters/page change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset to page 1 when filters change
  const handleSetFilters = useCallback((newFilters: UserFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  return {
    users,
    totalCount,
    currentPage,
    totalPages,
    isLoading,
    error,
    filterOptions,
    filters,
    setFilters: handleSetFilters,
    setPage: setCurrentPage,
    refresh: fetchUsers,
  };
}
