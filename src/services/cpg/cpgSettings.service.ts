/**
 * CPG Settings Service
 *
 * Manages company-wide CPG module settings including margin quality thresholds and colors.
 *
 * Features:
 * - Get or create default settings for a company
 * - Update margin thresholds
 * - Update colors
 * - Reset to defaults
 * - Settings-aware margin quality calculation
 */

import type { TreasureChestDB } from '../../db/database';
import type { CPGSettings } from '../../db/schema/cpg.schema';
import {
  createDefaultCPGSettings,
  validateCPGSettings,
} from '../../db/schema/cpg.schema';

export class CPGSettingsService {
  constructor(private db: TreasureChestDB) {}

  /**
   * Get settings for a company (creates default if doesn't exist)
   */
  async getOrCreateSettings(
    companyId: string,
    deviceId: string
  ): Promise<CPGSettings> {
    // Check if settings exist
    const existing = await this.db.cpgSettings
      .where('company_id')
      .equals(companyId)
      .and((s) => s.deleted_at === null && s.active)
      .first();

    if (existing) {
      return existing;
    }

    // Create default settings
    const defaultSettings = createDefaultCPGSettings(companyId, deviceId);

    const settings: CPGSettings = {
      ...defaultSettings,
    } as CPGSettings;

    await this.db.cpgSettings.add(settings);

    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(
    settingsId: string,
    updates: Partial<CPGSettings>,
    deviceId: string
  ): Promise<CPGSettings> {
    // Validate updates (isUpdate = true means company_id not required)
    const errors = validateCPGSettings(updates, true);
    if (errors.length > 0) {
      throw new Error(`Invalid settings: ${errors.join(', ')}`);
    }

    // Get current settings
    const current = await this.db.cpgSettings.get(settingsId);
    if (!current) {
      throw new Error('Settings not found');
    }

    // Update version vector
    const versionVector = { ...current.version_vector };
    versionVector[deviceId] = (versionVector[deviceId] || 0) + 1;

    // Apply updates
    await this.db.cpgSettings.update(settingsId, {
      ...updates,
      updated_at: Date.now(),
      version_vector: versionVector,
    });

    // Return updated settings
    const updated = await this.db.cpgSettings.get(settingsId);
    if (!updated) {
      throw new Error('Failed to retrieve updated settings');
    }

    return updated;
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(
    companyId: string,
    deviceId: string
  ): Promise<CPGSettings> {
    // Get existing settings
    const existing = await this.db.cpgSettings
      .where('company_id')
      .equals(companyId)
      .and((s) => s.deleted_at === null && s.active)
      .first();

    if (!existing) {
      throw new Error('No settings found to reset');
    }

    // Get default values
    const defaults = createDefaultCPGSettings(companyId, deviceId);

    // Update with defaults
    return this.updateSettings(
      existing.id,
      {
        margin_gut_check_max: defaults.margin_gut_check_max,
        margin_good_min: defaults.margin_good_min,
        margin_good_max: defaults.margin_good_max,
        margin_better_min: defaults.margin_better_min,
        margin_better_max: defaults.margin_better_max,
        margin_best_min: defaults.margin_best_min,
        color_gut_check: defaults.color_gut_check,
        color_good: defaults.color_good,
        color_better: defaults.color_better,
        color_best: defaults.color_best,
      },
      deviceId
    );
  }

  /**
   * Get margin quality based on settings (settings-aware version)
   */
  getMarginQuality(
    marginPercentage: string,
    settings: CPGSettings
  ): 'gutCheck' | 'good' | 'better' | 'best' {
    const margin = parseFloat(marginPercentage);
    const gutCheckMax = parseFloat(settings.margin_gut_check_max);
    const goodMax = parseFloat(settings.margin_good_max);
    const betterMax = parseFloat(settings.margin_better_max);

    if (margin < gutCheckMax) return 'gutCheck';
    if (margin < goodMax) return 'good';
    if (margin < betterMax) return 'better';
    return 'best';
  }

  /**
   * Get color for a margin quality level
   */
  getColorForQuality(
    quality: 'gutCheck' | 'good' | 'better' | 'best',
    settings: CPGSettings
  ): string {
    switch (quality) {
      case 'gutCheck':
        return settings.color_gut_check;
      case 'good':
        return settings.color_good;
      case 'better':
        return settings.color_better;
      case 'best':
        return settings.color_best;
      default:
        return settings.color_gut_check;
    }
  }

  /**
   * Format currency based on settings
   */
  formatCurrency(value: number, settings: CPGSettings): string {
    const decimalPlaces = settings.decimal_places_currency;

    // Get currency symbol
    const currencySymbols: Record<string, string> = {
      USD: '$',
      CAD: '$',
      EUR: '€',
      GBP: '£',
      AUD: '$',
      MXN: '$',
    };
    const symbol = currencySymbols[settings.currency_format] || '$';

    // Format number based on locale
    const formatted = value.toLocaleString(settings.number_format, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });

    return `${symbol}${formatted}`;
  }

  /**
   * Format number based on settings
   */
  formatNumber(value: number, settings: CPGSettings): string {
    return value.toLocaleString(settings.number_format, {
      minimumFractionDigits: settings.decimal_places_numbers,
      maximumFractionDigits: settings.decimal_places_numbers,
    });
  }

  /**
   * Format percentage based on settings
   */
  formatPercentage(value: number, settings: CPGSettings): string {
    const formatted = value.toLocaleString(settings.number_format, {
      minimumFractionDigits: settings.decimal_places_percentage,
      maximumFractionDigits: settings.decimal_places_percentage,
    });

    return `${formatted}%`;
  }

  /**
   * Format date based on settings
   */
  formatDate(date: Date | string | number, settings: CPGSettings): string {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    switch (settings.date_format) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      default:
        return `${month}/${day}/${year}`;
    }
  }
}
