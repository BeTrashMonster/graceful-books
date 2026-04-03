/**
 * CPG Formatting Utilities
 *
 * Provides formatting functions that automatically respect user settings.
 * Can be imported anywhere in the app (components, services, utilities).
 *
 * Usage:
 * import { formatCurrency, formatNumber, formatPercentage } from '@/utils/cpgFormatting';
 * const price = formatCurrency(1.23); // Returns "$1.23" or "$1.2300" depending on settings
 */

import { db } from '../db/database';
import type { CPGSettings } from '../db/schema/cpg.schema';
import { CPGSettingsService } from '../services/cpg/cpgSettings.service';

// Cache settings globally to avoid repeated DB queries
let settingsCache: CPGSettings | null = null;
let settingsLoadPromise: Promise<CPGSettings | null> | null = null;

/**
 * Load settings from database (cached)
 */
async function getSettings(companyId?: string): Promise<CPGSettings | null> {
  if (settingsCache) {
    return settingsCache;
  }

  if (settingsLoadPromise) {
    return settingsLoadPromise;
  }

  settingsLoadPromise = (async () => {
    try {
      // Try to get company ID from auth context if not provided
      if (!companyId) {
        // Get from localStorage or other source if available
        const authData = localStorage.getItem('auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          companyId = parsed.companyId;
        }
      }

      if (!companyId) {
        console.warn('[cpgFormatting] No company ID available, using defaults');
        return null;
      }

      const service = new CPGSettingsService(db);
      const settings = await service.getOrCreateSettings(companyId, 'global-util');
      settingsCache = settings;
      return settings;
    } catch (error) {
      console.error('[cpgFormatting] Failed to load settings:', error);
      return null;
    }
  })();

  return settingsLoadPromise;
}

/**
 * Clear the settings cache (call this when settings are updated)
 */
export function clearSettingsCache() {
  settingsCache = null;
  settingsLoadPromise = null;
}

// Listen for settings updates
if (typeof window !== 'undefined') {
  window.addEventListener('cpg-settings-updated', clearSettingsCache);
}

/**
 * Format currency synchronously (uses cached settings)
 * Falls back to default formatting if settings not loaded yet
 */
export function formatCurrency(value: number): string {
  if (!settingsCache) {
    console.warn('[cpgFormatting] formatCurrency called but cache is null, using default');
    // Settings not loaded yet, use default
    return `$${value.toFixed(2)}`;
  }

  const decimals = settingsCache.decimal_places_currency;

  // Get currency symbol
  const currencySymbols: Record<string, string> = {
    USD: '$',
    CAD: '$',
    EUR: '€',
    GBP: '£',
    AUD: '$',
    MXN: '$',
  };
  const symbol = currencySymbols[settingsCache.currency_format] || '$';

  // Format number based on locale
  // Use exact decimal places - same for min and max
  const formatted = value.toLocaleString(settingsCache.number_format, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${symbol}${formatted}`;
}

/**
 * Format number synchronously (uses cached settings)
 */
export function formatNumber(value: number): string {
  if (!settingsCache) {
    return value.toFixed(2);
  }

  return value.toLocaleString(settingsCache.number_format, {
    minimumFractionDigits: 0,
    maximumFractionDigits: settingsCache.decimal_places_numbers,
  });
}

/**
 * Format percentage synchronously (uses cached settings)
 */
export function formatPercentage(value: number): string {
  if (!settingsCache) {
    return `${value.toFixed(2)}%`;
  }

  const formatted = value.toLocaleString(settingsCache.number_format, {
    minimumFractionDigits: 0,
    maximumFractionDigits: settingsCache.decimal_places_percentage,
  });

  return `${formatted}%`;
}

/**
 * Initialize settings (call this at app startup)
 */
export async function initializeCPGFormatting(companyId?: string): Promise<void> {
  await getSettings(companyId);
  console.log('[cpgFormatting] Settings initialized:', settingsCache);
}
