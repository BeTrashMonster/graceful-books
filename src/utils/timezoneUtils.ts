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
 * Get start of day (00:00:00) in user's timezone, returned as UTC Date
 *
 * Example: User in PST selects "2024-06-08"
 * - This represents "2024-06-08 00:00:00 PST"
 * - Which is "2024-06-08 07:00:00 UTC" (PST is UTC-7 during DST)
 * - Returns Date object with that UTC timestamp
 *
 * Used for filtering: records with timestamps >= this value fall on or after this date in user's timezone
 */
export function getStartOfDay(dateString: string, timezone: string): Date {
  // Parse YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);

  // Create a date at noon UTC on the target date (avoids DST edge cases)
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Get what time it is in the target timezone when it's noon UTC
  const timeInTz = new Date(noonUTC.toLocaleString('en-US', { timeZone: timezone }));

  // Get what time it is in UTC when it's noon UTC (should be noon)
  const timeInUTC = new Date(noonUTC.toLocaleString('en-US', { timeZone: 'UTC' }));

  // The difference tells us the offset
  const offset = timeInUTC.getTime() - timeInTz.getTime();

  // Now create midnight in the target timezone
  const midnightLocal = new Date(year, month - 1, day, 0, 0, 0);

  // Apply the offset to get the UTC time that represents midnight in their timezone
  return new Date(midnightLocal.getTime() + offset);
}

/**
 * Get end of day (23:59:59.999) in user's timezone, returned as UTC Date
 */
export function getEndOfDay(dateString: string, timezone: string): Date {
  const startOfDay = getStartOfDay(dateString, timezone);
  // Add 24 hours minus 1 millisecond
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
 * Get date in user's timezone as YYYY-MM-DD string
 *
 * Converts a Date object to a date string in the user's timezone
 */
export function getDateInTimezone(date: Date, timezone: string): string {
  const formatted = new Intl.DateTimeFormat('en-CA', { // en-CA gives us YYYY-MM-DD format
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

  return formatted; // Returns "YYYY-MM-DD"
}

/**
 * Check if a timestamp falls on a specific date in user's timezone
 *
 * Example: User in PST, checking if timestamp falls on "2024-06-08"
 */
export function isDateInTimezone(timestamp: number | Date, dateString: string, timezone: string): boolean {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  const dateInTz = getDateInTimezone(date, timezone);
  return dateInTz === dateString;
}
