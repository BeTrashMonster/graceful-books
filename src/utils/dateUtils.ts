/**
 * Date Utilities
 *
 * Helper functions for date handling with UX improvements
 */

/**
 * Expand 2-digit year to 4-digit year
 * Rules:
 * - 00-50 → 2000-2050
 * - 51-99 → 1951-1999
 *
 * @param yearString - 2-digit or 4-digit year string
 * @returns 4-digit year string
 */
export function expandYear(yearString: string): string {
  // If already 4 digits, return as-is
  if (yearString.length === 4) {
    return yearString;
  }

  // If 2 digits, expand to 4
  if (yearString.length === 2) {
    const year = parseInt(yearString, 10);
    if (isNaN(year)) return yearString;

    // 00-50 → 2000-2050
    if (year >= 0 && year <= 50) {
      return `20${yearString}`;
    }
    // 51-99 → 1951-1999
    if (year >= 51 && year <= 99) {
      return `19${yearString}`;
    }
  }

  return yearString;
}

/**
 * Process date input and expand 2-digit years
 * Supports formats:
 * - MMDDYY (022626 → 02/26/2026)
 * - MMDDYYYY (02262026 → 02/26/2026)
 * - MM/DD/YY or MM/DD/YYYY
 * - YYYY-MM-DD
 *
 * @param dateString - Date string in various formats
 * @returns Object with formatted date string (MM/DD/YYYY) and ISO format (YYYY-MM-DD)
 */
export function processDateInput(dateString: string): { formatted: string; iso: string } {
  if (!dateString) return { formatted: dateString, iso: dateString };

  const trimmed = dateString.trim();

  // Handle YYYY-MM-DD format (native date input) - convert to MM/DD/YYYY for display
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return { formatted: `${month}/${day}/${year}`, iso: trimmed };
  }

  // Handle MMDDYY format (6 digits, no separators) - 022626
  if (/^\d{6}$/.test(trimmed)) {
    const month = trimmed.substring(0, 2);
    const day = trimmed.substring(2, 4);
    const year = trimmed.substring(4, 6);
    const expandedYear = expandYear(year);
    const formatted = `${month}/${day}/${expandedYear}`;
    const iso = `${expandedYear}-${month}-${day}`;
    return { formatted, iso };
  }

  // Handle MMDDYYYY format (8 digits, no separators) - 02262026
  if (/^\d{8}$/.test(trimmed)) {
    const month = trimmed.substring(0, 2);
    const day = trimmed.substring(2, 4);
    const year = trimmed.substring(4, 8);
    const formatted = `${month}/${day}/${year}`;
    const iso = `${year}-${month}-${day}`;
    return { formatted, iso };
  }

  // Handle MM/DD/YY or MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const expandedYear = expandYear(year);
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    const formatted = `${paddedMonth}/${paddedDay}/${expandedYear}`;
    const iso = `${expandedYear}-${paddedMonth}-${paddedDay}`;
    return { formatted, iso };
  }

  // Handle YYYY-MM-D or YYYY-M-DD or YYYY-M-D (missing padding)
  const dashMatch = trimmed.match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    const [, year, month, day] = dashMatch;
    const expandedYear = expandYear(year);
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    const formatted = `${paddedMonth}/${paddedDay}/${expandedYear}`;
    const iso = `${expandedYear}-${paddedMonth}-${paddedDay}`;
    return { formatted, iso };
  }

  return { formatted: trimmed, iso: trimmed };
}
