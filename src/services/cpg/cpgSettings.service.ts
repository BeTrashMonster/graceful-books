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

import { nanoid } from 'nanoid';
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
    const id = nanoid();

    const settings: CPGSettings = {
      id,
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
}
