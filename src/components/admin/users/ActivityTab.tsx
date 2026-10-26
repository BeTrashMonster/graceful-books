/**
 * ActivityTab Component
 *
 * Displays user activity history for admin diagnostics.
 * Shows login events, page views, actions, and system events.
 */

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../../config/api';
import styles from './ActivityTab.module.css';

interface ActivityEntry {
  id: string;
  userId: string;
  activityType: 'login' | 'page_view' | 'action' | 'system' | 'email' | 'payment';
  activityName: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ActivityStats {
  totalActivities: number;
  lastActivityAt: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  activityByType: Record<string, number>;
}

interface ActivityTabProps {
  userId: string;
}

type FilterType = 'all' | 'login' | 'system' | 'email' | 'payment';

export function ActivityTab({ userId }: ActivityTabProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const getSession = useCallback(() => {
    const sessionData = sessionStorage.getItem('graceful_books_admin_session');
    return sessionData ? JSON.parse(sessionData) : null;
  }, []);

  const fetchActivities = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '25',
      });

      if (filter !== 'all') {
        params.append('activityType', filter);
      }

      const response = await fetch(
        `${API_URL}/admin/users/${userId}/activity?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch activity history');
      }

      const responseData = await response.json();
      // Unwrap API response - backend wraps data in { data: ... }
      const data = responseData.data || responseData;
      setActivities(data.activities || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  }, [userId, page, filter, getSession]);

  const fetchStats = useCallback(async () => {
    const session = getSession();
    if (!session) return;

    try {
      const response = await fetch(
        `${API_URL}/admin/users/${userId}/activity/stats`,
        {
          headers: {
            'Authorization': `Bearer ${session.token}`,
          },
        }
      );

      if (response.ok) {
        const responseData = await response.json();
        // Unwrap API response - backend wraps data in { data: ... }
        const statsData = responseData.data || responseData;
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to fetch activity stats:', err);
    }
  }, [userId, getSession]);

  useEffect(() => {
    fetchActivities();
    fetchStats();
  }, [fetchActivities, fetchStats]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case 'login':
        return 'L';
      case 'page_view':
        return 'P';
      case 'system':
        return 'S';
      case 'email':
        return 'E';
      case 'payment':
        return '$';
      default:
        return '?';
    }
  };

  const getActivityTypeLabel = (type: string): string => {
    switch (type) {
      case 'login':
        return 'Login';
      case 'page_view':
        return 'Page View';
      case 'system':
        return 'System';
      case 'email':
        return 'Email';
      case 'payment':
        return 'Payment';
      default:
        return type;
    }
  };

  return (
    <div className={styles.container}>
      {/* Stats Summary */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalActivities}</span>
            <span className={styles.statLabel}>Total Activities</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.loginCount}</span>
            <span className={styles.statLabel}>Total Logins</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.lastLoginAt ? formatRelativeTime(stats.lastLoginAt) : 'Never'}
            </span>
            <span className={styles.statLabel}>Last Login</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.lastActivityAt ? formatRelativeTime(stats.lastActivityAt) : 'Never'}
            </span>
            <span className={styles.statLabel}>Last Activity</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Filter:</span>
        <div className={styles.filterButtons}>
          {(['all', 'login', 'system', 'email', 'payment'] as FilterType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`${styles.filterButton} ${filter === type ? styles.active : ''}`}
              onClick={() => {
                setFilter(type);
                setPage(1);
              }}
            >
              {type === 'all' ? 'All' : getActivityTypeLabel(type)}
              {stats?.activityByType?.[type] !== undefined && (
                <span className={styles.filterCount}>
                  {stats.activityByType[type]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      {error && <div className={styles.error}>{error}</div>}

      {isLoading ? (
        <div className={styles.loading}>Loading activities...</div>
      ) : activities.length === 0 ? (
        <div className={styles.emptyState}>
          No activities found
          {filter !== 'all' && <span> for this filter</span>}
        </div>
      ) : (
        <div className={styles.activityList}>
          {activities.map((activity) => (
            <div key={activity.id} className={styles.activityItem}>
              <div className={`${styles.activityIcon} ${styles[activity.activityType]}`}>
                {getActivityIcon(activity.activityType)}
              </div>
              <div className={styles.activityContent}>
                <div className={styles.activityHeader}>
                  <span className={styles.activityName}>{activity.activityName}</span>
                  <span className={styles.activityTime}>
                    {formatRelativeTime(activity.createdAt)}
                  </span>
                </div>
                <div className={styles.activityMeta}>
                  <span className={`${styles.activityType} ${styles[activity.activityType]}`}>
                    {getActivityTypeLabel(activity.activityType)}
                  </span>
                  {activity.ipAddress && (
                    <span className={styles.ipAddress}>{activity.ipAddress}</span>
                  )}
                </div>
                {Object.keys(activity.metadata).length > 0 && (
                  <div className={styles.activityMetadata}>
                    {Object.entries(activity.metadata).map(([key, value]) => (
                      <span key={key} className={styles.metadataItem}>
                        <span className={styles.metadataKey}>{key}:</span>
                        <span className={styles.metadataValue}>
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageButton}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageButton}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
