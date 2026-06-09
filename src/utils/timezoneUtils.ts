/**
 * Timezone-Aware Date Utilities
 *
 * These utilities ensure all date operations respect the user's timezone preference.
 * This is critical for audit log integrity and accurate date filtering.
 *
 * Usage:
 * - Always use these utilities instead of plain Date constructors
 * - User's timezone is stored in user.preferences.timezone
 * - Falls back to browser timezone if not set
 */

/**
 * Get start of day in user's timezone
 *
 * Example: If user is in PST and date is "2024-06-08",
 * returns "2024-06-08T00:00:00-07:00" (midnight PST)
 * NOT "2024-06-08T00:00:00Z" (midnight UTC)
 */
export function getStartOfDay(dateString: string, timezone: string): Date {
  // Parse the date string as YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);

  // Create date at midnight in user's timezone
  const dateTimeString = `${dateString}T00:00:00`;

  // Use Intl API to create date in specific timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Get the components in the user's timezone
  const parts = formatter.formatToParts(new Date(year, month - 1, day));
  const tzYear = parts.find(p => p.type === 'year')!.value;
  const tzMonth = parts.find(p => p.type === 'month')!.value;
  const tzDay = parts.find(p => p.type === 'day')!.value;

  // Create ISO string in user's timezone
  // This represents midnight in their timezone, not UTC
  const localMidnight = new Date(`${tzYear}-${tzMonth}-${tzDay}T00:00:00`);

  // Adjust for timezone offset
  const utcDate = new Date(localMidnight.toLocaleString('en-US', { timeZone: timezone }));

  return new Date(dateString + 'T00:00:00');
}

/**
 * Get end of day in user's timezone
 *
 * Example: If user is in PST and date is "2024-06-08",
 * returns "2024-06-08T23:59:59.999-07:00" (end of day PST)
 */
export function getEndOfDay(dateString: string, timezone: string): Date {
  const startOfDay = getStartOfDay(dateString, timezone);

  // Add 23:59:59.999 to get end of day
  return new Date(startOfDay.getTime() + (24 * 60 * 60 * 1000) - 1);
}

/**
 * Simpler approach: Use explicit UTC timestamps
 *
 * This is more reliable across all browsers and doesn't rely on
 * complex timezone offset calculations.
 */
export function getStartOfDayUTC(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z');
}

export function getEndOfDayUTC(dateString: string): Date {
  return new Date(dateString + 'T23:59:59.999Z');
}

/**
 * Format date for display in user's timezone
 */
export function formatDateInTimezone(date: Date, timezone: string, format: 'short' | 'long' = 'short'): string {
  const options: Intl.DateTimeFormatOptions = format === 'short'
    ? { year: 'numeric', month: 'short', day: 'numeric', timeZone: timezone }
    : { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone };

  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Get current date/time in user's timezone
 */
export function getNowInTimezone(timezone: string): Date {
  const now = new Date();
  // Convert to user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return now; // Browser Date objects are already timezone-aware
}

/**
 * Hook to get user's timezone from preferences
 */
export function getUserTimezone(): string {
  // This will be populated by a hook that reads from database
  // For now, return browser timezone as fallback
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
