/**
 * useTimezone Hook
 *
 * Returns the user's preferred timezone from their database preferences.
 * Falls back to browser timezone if not set.
 *
 * Usage:
 *   const timezone = useTimezone();
 *   const formattedDate = formatDateInTimezone(date, timezone);
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../db/database';

export function useTimezone(): string {
  const { userIdentifier } = useAuth();
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  useEffect(() => {
    const loadTimezone = async () => {
      if (!userIdentifier) {
        // Not logged in, use browser timezone
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(browserTz);
        return;
      }

      try {
        const users = await db.users.where('email').equals(userIdentifier).toArray();

        if (users.length > 0 && users[0].preferences?.timezone) {
          setTimezone(users[0].preferences.timezone);
        } else {
          // User exists but no timezone set, use browser timezone
          const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setTimezone(browserTz);
        }
      } catch (err) {
        console.error('[useTimezone] Error loading timezone:', err);
        // On error, fall back to browser timezone
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(browserTz);
      }
    };

    loadTimezone();

    // Listen for timezone changes from Settings page
    const handleTimezoneUpdate = () => {
      loadTimezone();
    };

    window.addEventListener('timezone-updated', handleTimezoneUpdate);

    return () => {
      window.removeEventListener('timezone-updated', handleTimezoneUpdate);
    };
  }, [userIdentifier]);

  return timezone;
}
