/**
 * useRecentActivity Hook
 *
 * Fetches recent activity/edits for the "Resume Where You Left Off" widget.
 */

import { useState, useEffect } from 'react';
import type { RecentEditEntry } from '../types/recentActivity.types';
import { db } from '../db/database';

export function useRecentActivity(companyId: string, limit = 5): {
  recentEdits: RecentEditEntry[];
  isLoading: boolean;
  error: Error | null;
} {
  const [recentEdits, setRecentEdits] = useState<RecentEditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRecentActivity() {
      try {
        setIsLoading(true);
        setError(null);

        // Check if recentActivity table exists
        const recentActivityExists = db.tables.some(table => table.name === 'recentActivity');

        if (recentActivityExists) {
          // Fetch from recentActivity table
          const activities = await db.recentActivity
            .where('company_id')
            .equals(companyId)
            .reverse()
            .sortBy('edited_at');

          const limitedActivities = activities.slice(0, limit);

          if (mounted) {
            // Map RecentActivity[] to RecentEditEntry[]
            const editEntries: RecentEditEntry[] = limitedActivities.map(activity => ({
              id: activity.id,
              entity_type: activity.entity_type,
              entity_id: activity.entity_id || '',
              label: activity.entity_label,
              timestamp: activity.timestamp,
            }));
            setRecentEdits(editEntries);
          }
        } else {
          // Fallback: Return empty array (table will be created when user edits something)
          if (mounted) {
            setRecentEdits([]);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch recent activity'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    if (companyId) {
      fetchRecentActivity();
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [companyId, limit]);

  return { recentEdits, isLoading, error };
}
