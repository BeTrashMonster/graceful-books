import { useState, useEffect } from 'react';
import { Button } from '../../components/core/Button';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../db';
import { CPGSettingsService } from '../../services/cpg/cpgSettings.service';
import { UserFeaturePreferencesService } from '../../services/userFeaturePreferences.service';
import { DataSafetyPanel } from '../../components/settings/DataSafetyPanel';
import type { FeatureName } from '../../services/userFeaturePreferences.service';
import type { CPGSettings } from '../../db/schema/cpg.schema';
import styles from './CPGSettings.module.css';

/**
 * CPG Settings Page
 *
 * Allows configuration of margin quality thresholds and colors at the company level.
 *
 * Features:
 * - Editable margin thresholds (Gut Check, Good, Better, Best)
 * - Inline color pickers for each quality level
 * - Reset to defaults
 * - Auto-saves on change
 */
export function CPGSettings() {
  const { companyId, deviceId, userIdentifier: userId } = useAuth();

  const [settings, setSettings] = useState<CPGSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [gutCheckMax, setGutCheckMax] = useState('50');
  const [goodMin, setGoodMin] = useState('50');
  const [goodMax, setGoodMax] = useState('60');
  const [betterMin, setBetterMin] = useState('60');
  const [betterMax, setBetterMax] = useState('70');
  const [bestMin, setBestMin] = useState('70');

  const [colorGutCheck, setColorGutCheck] = useState('#dc2626');
  const [colorGood, setColorGood] = useState('#2563eb');
  const [colorBetter, setColorBetter] = useState('#16a34a');
  const [colorBest, setColorBest] = useState('#7c3aed');

  // Financial Defaults state
  const [defaultLaborRate, setDefaultLaborRate] = useState('20.00');

  // Reporting Preferences state
  const [defaultReportDateRange, setDefaultReportDateRange] = useState('last_30_days');
  const [includeDeletedInReports, setIncludeDeletedInReports] = useState(false);

  // Display & Format Preferences state
  const [currencyFormat, setCurrencyFormat] = useState('USD');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [numberFormat, setNumberFormat] = useState('en-US');
  const [decimalPlacesCurrency, setDecimalPlacesCurrency] = useState(2);
  const [decimalPlacesNumbers, setDecimalPlacesNumbers] = useState(2);
  const [decimalPlacesPercentage, setDecimalPlacesPercentage] = useState(2);

  // Data Management state
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const [deletedRecordRetentionDays, setDeletedRecordRetentionDays] = useState(90);

  // Feature Preferences state
  const [userFeaturePrefs, setUserFeaturePrefs] = useState<Record<FeatureName, boolean>>({
    events: false,
    distribution: false,
    promos: false,
  });

  // Debug: Log whenever userFeaturePrefs changes
  useEffect(() => {
    console.log('🔄 Settings: userFeaturePrefs state changed to:', userFeaturePrefs);
  }, [userFeaturePrefs]);

  // Collapsible section state
  const [featuresSectionExpanded, setFeaturesSectionExpanded] = useState(true);
  const [marginSectionExpanded, setMarginSectionExpanded] = useState(false);
  const [financialSectionExpanded, setFinancialSectionExpanded] = useState(false);
  const [displaySectionExpanded, setDisplaySectionExpanded] = useState(false);
  const [reportingSectionExpanded, setReportingSectionExpanded] = useState(false);
  const [dataSectionExpanded, setDataSectionExpanded] = useState(false);

  /**
   * Load user feature preferences
   */
  useEffect(() => {
    if (!userId) {
      console.warn('⚠️ Settings: No userId, cannot load preferences');
      return;
    }

    const loadUserPreferences = async () => {
      try {
        console.log('🔍 Settings: Loading preferences for userId:', userId);

        // Debug: Check raw database records
        const rawRecords = await db.userFeaturePreferences
          .where('user_id')
          .equals(userId)
          .toArray();
        console.log('🗄️ Settings: Raw DB records:', rawRecords);

        const prefsService = new UserFeaturePreferencesService(db);
        const prefs = await prefsService.getUserPreferences(userId);
        console.log('📋 Settings: Loaded preferences from service:', prefs);
        setUserFeaturePrefs(prefs);
        console.log('✅ Settings: State updated with preferences');
      } catch (err) {
        console.error('❌ Settings: Failed to load user feature preferences:', err);
      }
    };

    loadUserPreferences();
  }, [userId]);

  /**
   * Load settings on mount
   */
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const service = new CPGSettingsService(db);
        const loadedSettings = await service.getOrCreateSettings(
          companyId,
          deviceId
        );

        setSettings(loadedSettings);

        // Populate form state
        setGutCheckMax(loadedSettings.margin_gut_check_max);
        setGoodMin(loadedSettings.margin_good_min);
        setGoodMax(loadedSettings.margin_good_max);
        setBetterMin(loadedSettings.margin_better_min);
        setBetterMax(loadedSettings.margin_better_max);
        setBestMin(loadedSettings.margin_best_min);

        setColorGutCheck(loadedSettings.color_gut_check);
        setColorGood(loadedSettings.color_good);
        setColorBetter(loadedSettings.color_better);
        setColorBest(loadedSettings.color_best);

        // Financial Defaults
        setDefaultLaborRate(loadedSettings.default_labor_rate);

        // Reporting Preferences
        setDefaultReportDateRange(loadedSettings.default_report_date_range);
        setIncludeDeletedInReports(loadedSettings.include_deleted_in_reports);

        // Display & Format Preferences
        setCurrencyFormat(loadedSettings.currency_format);
        setDateFormat(loadedSettings.date_format);
        setNumberFormat(loadedSettings.number_format);
        setDecimalPlacesCurrency(loadedSettings.decimal_places_currency);
        setDecimalPlacesNumbers(loadedSettings.decimal_places_numbers);
        setDecimalPlacesPercentage(loadedSettings.decimal_places_percentage);

        // Data Management
        setAutoSaveInterval(loadedSettings.auto_save_interval);
        setDeletedRecordRetentionDays(loadedSettings.deleted_record_retention_days);
      } catch (error) {
        console.error('Failed to load CPG settings:', error);
        setErrorMessage(`Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [companyId, deviceId]);

  /**
   * Toggle feature activation
   */
  const handleToggleFeature = async (featureName: FeatureName) => {
    if (!userId) {
      console.error('No userId available for feature toggle');
      setErrorMessage('User not authenticated. Please refresh the page.');
      return;
    }

    console.log('🔄 Settings: Toggling feature:', featureName, 'Current state:', userFeaturePrefs[featureName], 'UserId:', userId);

    try {
      const prefsService = new UserFeaturePreferencesService(db);
      const newState = await prefsService.toggleFeature(userId, featureName);

      console.log('✅ Settings: Feature toggled in DB:', featureName, 'New state:', newState);

      // Update local state immediately
      const updatedPrefs = {
        ...userFeaturePrefs,
        [featureName]: newState,
      };

      console.log('🔄 Settings: Updated local state from', userFeaturePrefs, 'to', updatedPrefs);
      setUserFeaturePrefs(updatedPrefs);

      // Notify other components with the FULL updated preferences
      // This avoids race conditions from re-querying the database
      console.log('📢 Settings: Firing feature-preferences-updated event with full prefs:', updatedPrefs);
      window.dispatchEvent(new CustomEvent('feature-preferences-updated', {
        detail: {
          featureName,
          newState,
          allPreferences: updatedPrefs  // Pass the complete updated state
        }
      }));
      console.log('✅ Settings: Event dispatched successfully');

      setSuccessMessage(`Feature ${newState ? 'activated' : 'deactivated'} successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('❌ Settings: Failed to toggle feature:', err);
      setErrorMessage(`Failed to update feature: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  /**
   * Save settings
   */
  const handleSave = async () => {
    if (!settings || !deviceId) {
      console.error('Cannot save: missing settings or deviceId', { settings, deviceId });
      setErrorMessage('Cannot save settings: missing required data');
      return;
    }

    console.log('💾 Saving settings...', {
      currencyFormat,
      dateFormat,
      numberFormat,
      decimalPlacesCurrency,
      decimalPlacesNumbers,
      decimalPlacesPercentage,
    });

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const service = new CPGSettingsService(db);
      const updated = await service.updateSettings(
        settings.id,
        {
          // Margin Quality Thresholds
          margin_gut_check_max: gutCheckMax,
          margin_good_min: goodMin,
          margin_good_max: goodMax,
          margin_better_min: betterMin,
          margin_better_max: betterMax,
          margin_best_min: bestMin,
          color_gut_check: colorGutCheck,
          color_good: colorGood,
          color_better: colorBetter,
          color_best: colorBest,

          // Financial Defaults
          default_labor_rate: defaultLaborRate,

          // Reporting Preferences
          default_report_date_range: defaultReportDateRange,
          include_deleted_in_reports: includeDeletedInReports,

          // Display & Format Preferences
          currency_format: currencyFormat,
          date_format: dateFormat,
          number_format: numberFormat,
          decimal_places_currency: decimalPlacesCurrency,
          decimal_places_numbers: decimalPlacesNumbers,
          decimal_places_percentage: decimalPlacesPercentage,

          // Data Management
          auto_save_interval: autoSaveInterval,
          deleted_record_retention_days: deletedRecordRetentionDays,
        },
        deviceId
      );

      console.log('✅ Settings saved successfully!', updated);

      setSettings(updated);
      setSuccessMessage('Settings saved successfully!');

      // Dispatch event to notify other components of settings update
      window.dispatchEvent(new CustomEvent('cpg-settings-updated'));

      // Clear success message after 5 seconds (increased from 3)
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Fix purple color (one-time migration helper)
   */
  const handleFixPurple = async () => {
    if (!settings || !deviceId) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const service = new CPGSettingsService(db);
      const updated = await service.updateSettings(
        settings.id,
        {
          color_best: '#7c3aed', // Royal purple
        },
        deviceId
      );

      setSettings(updated);
      setColorBest('#7c3aed');
      setSuccessMessage('Purple color fixed!');

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to fix color:', error);
      setErrorMessage('Failed to fix color. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Reset to defaults
   */
  const handleReset = async () => {
    if (!companyId || !deviceId) return;

    if (
      !window.confirm(
        'Are you sure you want to reset all settings to defaults? This cannot be undone.'
      )
    ) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const service = new CPGSettingsService(db);
      const updated = await service.resetToDefaults(
        companyId,
        deviceId
      );

      setSettings(updated);

      // Populate form state with defaults
      setGutCheckMax(updated.margin_gut_check_max);
      setGoodMin(updated.margin_good_min);
      setGoodMax(updated.margin_good_max);
      setBetterMin(updated.margin_better_min);
      setBetterMax(updated.margin_better_max);
      setBestMin(updated.margin_best_min);

      setColorGutCheck(updated.color_gut_check);
      setColorGood(updated.color_good);
      setColorBetter(updated.color_better);
      setColorBest(updated.color_best);

      // Financial Defaults
      setDefaultLaborRate(updated.default_labor_rate);

      // Reporting Preferences
      setDefaultReportDateRange(updated.default_report_date_range);
      setIncludeDeletedInReports(updated.include_deleted_in_reports);

      // Display & Format Preferences
      setCurrencyFormat(updated.currency_format);
      setDateFormat(updated.date_format);
      setNumberFormat(updated.number_format);
      setDecimalPlacesCurrency(updated.decimal_places_currency);
      setDecimalPlacesNumbers(updated.decimal_places_numbers);
      setDecimalPlacesPercentage(updated.decimal_places_percentage);

      // Data Management
      setAutoSaveInterval(updated.auto_save_interval);
      setDeletedRecordRetentionDays(updated.deleted_record_retention_days);

      setSuccessMessage('Settings reset to defaults!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setErrorMessage('Failed to reset settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingIcon}>⚙️</div>
          <p className={styles.loadingText}>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>
          Configure defaults and preferences.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className={styles.successMessage}>
          <span className={styles.messageIcon}>✓</span>
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className={styles.errorMessage}>
          <span className={styles.messageIcon}>✕</span>
          {errorMessage}
        </div>
      )}

      {/* Data Safety Panel - Backup Configuration */}
      <DataSafetyPanel companyId={companyId || undefined} />

      {/* Settings Sections */}

      {/* Feature Preferences Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setFeaturesSectionExpanded(!featuresSectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <span className={styles.sectionIcon}>🎯</span>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Dashboard Feature Activations</h2>
              <p className={styles.sectionSubtitle}>
                Activate or deactivate features to customize your workspace
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${featuresSectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${featuresSectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Control which features appear in your sidebar navigation and dashboard. Inactive features won't show in navigation but your data is always preserved.
            </p>

            <div className={styles.featureToggles}>
              {/* Events Feature */}
              <div className={styles.featureToggleRow}>
                <div className={styles.featureInfo}>
                  <strong>Events Analysis</strong>
                  <p className={styles.featureDescription}>
                    Track event costs, traveling, labor, and sweat equity
                  </p>
                </div>
                <button
                  onClick={() => handleToggleFeature('events')}
                  className={`${styles.toggleButton} ${userFeaturePrefs.events ? styles.toggleActive : styles.toggleInactive}`}
                >
                  <span className={styles.toggleLabel}>
                    {userFeaturePrefs.events ? 'Active' : 'Inactive'}
                  </span>
                  <span className={styles.toggleSlider}></span>
                </button>
              </div>

              {/* Distribution Feature */}
              <div className={styles.featureToggleRow}>
                <div className={styles.featureInfo}>
                  <strong>Distribution Center</strong>
                  <p className={styles.featureDescription}>
                    Analyze distribution costs and compare distributor fees
                  </p>
                </div>
                <button
                  onClick={() => handleToggleFeature('distribution')}
                  className={`${styles.toggleButton} ${userFeaturePrefs.distribution ? styles.toggleActive : styles.toggleInactive}`}
                >
                  <span className={styles.toggleLabel}>
                    {userFeaturePrefs.distribution ? 'Active' : 'Inactive'}
                  </span>
                  <span className={styles.toggleSlider}></span>
                </button>
              </div>

              {/* Promos Feature */}
              <div className={styles.featureToggleRow}>
                <div className={styles.featureInfo}>
                  <strong>Promo Analysis</strong>
                  <p className={styles.featureDescription}>
                    Calculate promo costs and demo ROI
                  </p>
                </div>
                <button
                  onClick={() => handleToggleFeature('promos')}
                  className={`${styles.toggleButton} ${userFeaturePrefs.promos ? styles.toggleActive : styles.toggleInactive}`}
                >
                  <span className={styles.toggleLabel}>
                    {userFeaturePrefs.promos ? 'Active' : 'Inactive'}
                  </span>
                  <span className={styles.toggleSlider}></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setDataSectionExpanded(!dataSectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <span className={styles.sectionIcon}>💾</span>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Data Management</h2>
              <p className={styles.sectionSubtitle}>
                Auto-save and data retention settings
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${dataSectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${dataSectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Control how often data is saved and how long deleted records are kept.
            </p>

            <div className={styles.formGrid}>
              {/* Auto-save Interval */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="auto-save-interval">
                  Auto-save Interval (seconds)
                </label>
                <select
                  id="auto-save-interval"
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(parseInt(e.target.value))}
                  className={styles.select}
                >
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>

              {/* Retention Days */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="retention-days">
                  Keep Deleted Records For
                </label>
                <select
                  id="retention-days"
                  value={deletedRecordRetentionDays}
                  onChange={(e) => setDeletedRecordRetentionDays(parseInt(e.target.value))}
                  className={styles.select}
                >
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Display & Format Preferences Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setDisplaySectionExpanded(!displaySectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <span className={styles.sectionIcon}>🌐</span>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Display & Format Preferences</h2>
              <p className={styles.sectionSubtitle}>
                Currency, date, and number formatting options
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${displaySectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${displaySectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Control how currencies, dates, and numbers are displayed throughout the application.
            </p>

            <div className={styles.formGrid}>
              {/* Currency Format */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="currency-format">
                  Currency
                </label>
                <select
                  id="currency-format"
                  value={currencyFormat}
                  onChange={(e) => setCurrencyFormat(e.target.value)}
                  className={styles.select}
                >
                  <option value="USD">USD - US Dollar ($)</option>
                  <option value="CAD">CAD - Canadian Dollar ($)</option>
                  <option value="EUR">EUR - Euro (€)</option>
                  <option value="GBP">GBP - British Pound (£)</option>
                  <option value="AUD">AUD - Australian Dollar ($)</option>
                  <option value="MXN">MXN - Mexican Peso ($)</option>
                </select>
              </div>

              {/* Date Format */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="date-format">
                  Date Format
                </label>
                <select
                  id="date-format"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className={styles.select}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (International)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                </select>
              </div>

              {/* Number Format */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="number-format">
                  Number Format
                </label>
                <select
                  id="number-format"
                  value={numberFormat}
                  onChange={(e) => setNumberFormat(e.target.value)}
                  className={styles.select}
                >
                  <option value="en-US">1,234.56 (US/UK)</option>
                  <option value="de-DE">1.234,56 (Germany/Europe)</option>
                  <option value="fr-FR">1 234,56 (France)</option>
                </select>
              </div>

              {/* Decimal Places - Currency */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="decimal-currency">
                  Currency Decimal Places
                </label>
                <select
                  id="decimal-currency"
                  value={decimalPlacesCurrency}
                  onChange={(e) => setDecimalPlacesCurrency(parseInt(e.target.value))}
                  className={styles.select}
                >
                  <option value="0">Round to dollar ($123)</option>
                  <option value="2">Show cents ($123.45)</option>
                </select>
              </div>

              {/* Decimal Places - Numbers */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="decimal-numbers">
                  Number Decimal Places
                </label>
                <select
                  id="decimal-numbers"
                  value={decimalPlacesNumbers}
                  onChange={(e) => setDecimalPlacesNumbers(parseInt(e.target.value))}
                  className={styles.select}
                >
                  <option value="0">0 (123)</option>
                  <option value="1">1 (123.4)</option>
                  <option value="2">2 (123.45)</option>
                  <option value="3">3 (123.456)</option>
                  <option value="4">4 (123.4567)</option>
                </select>
                <p className={styles.fieldHint}>
                  For quantities, weights, and units
                </p>
              </div>

              {/* Decimal Places - Percentage */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="decimal-percentage">
                  Percentage Decimal Places
                </label>
                <select
                  id="decimal-percentage"
                  value={decimalPlacesPercentage}
                  onChange={(e) => setDecimalPlacesPercentage(parseInt(e.target.value))}
                  className={styles.select}
                >
                  <option value="0">0 (12%)</option>
                  <option value="1">1 (12.3%)</option>
                  <option value="2">2 (12.34%)</option>
                  <option value="3">3 (12.345%)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Defaults Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setFinancialSectionExpanded(!financialSectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <span className={styles.sectionIcon}>💰</span>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Financial Defaults</h2>
              <p className={styles.sectionSubtitle}>
                Default labor rate for promo calculations
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${financialSectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${financialSectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Set the default hourly rate used for calculating demo and promo labor costs.
            </p>

            <div className={styles.formGrid}>
              {/* Labor Rate */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="default-labor-rate">
                  Default Labor Rate ($/hour)
                </label>
                <input
                  id="default-labor-rate"
                  type="number"
                  value={defaultLaborRate}
                  onChange={(e) => setDefaultLaborRate(e.target.value)}
                  className={styles.input}
                  min="0"
                  step="0.01"
                  placeholder="20.00"
                />
                <p className={styles.fieldHint}>
                  Used for calculating labor costs in promo and demo scenarios
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Margin Quality Thresholds Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setMarginSectionExpanded(!marginSectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <span className={styles.sectionIcon}>🎨</span>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Margin Quality Thresholds</h2>
              <p className={styles.sectionSubtitle}>
                Define margin ranges and colors for quality levels
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${marginSectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${marginSectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Define the margin percentage ranges and colors for each quality level.
              These apply to all CPU calculations and promo analyses.
            </p>

            <div className={styles.thresholdsGrid}>
          {/* Gut Check */}
          <div className={styles.thresholdRow}>
            <div className={styles.thresholdLabel}>
              <input
                type="color"
                value={colorGutCheck}
                onChange={(e) => setColorGutCheck(e.target.value)}
                className={styles.colorPicker}
                title="Gut Check Color"
              />
              <span className={styles.labelText}>Gut Check</span>
            </div>
            <div className={styles.thresholdInputs}>
              <span className={styles.operator}>&lt;</span>
              <input
                type="number"
                value={gutCheckMax}
                onChange={(e) => setGutCheckMax(e.target.value)}
                className={styles.percentInput}
                min="0"
                max="100"
                step="1"
              />
              <span className={styles.unit}>%</span>
            </div>
          </div>

          {/* Good */}
          <div className={styles.thresholdRow}>
            <div className={styles.thresholdLabel}>
              <input
                type="color"
                value={colorGood}
                onChange={(e) => setColorGood(e.target.value)}
                className={styles.colorPicker}
                title="Good Color"
              />
              <span className={styles.labelText}>Good</span>
            </div>
            <div className={styles.thresholdInputs}>
              <input
                type="number"
                value={goodMin}
                onChange={(e) => setGoodMin(e.target.value)}
                className={styles.percentInput}
                min="0"
                max="100"
                step="1"
              />
              <span className={styles.unit}>%</span>
              <span className={styles.operator}>-</span>
              <input
                type="number"
                value={goodMax}
                onChange={(e) => setGoodMax(e.target.value)}
                className={styles.percentInput}
                min="0"
                max="100"
                step="1"
              />
              <span className={styles.unit}>%</span>
            </div>
          </div>

          {/* Better */}
          <div className={styles.thresholdRow}>
            <div className={styles.thresholdLabel}>
              <input
                type="color"
                value={colorBetter}
                onChange={(e) => setColorBetter(e.target.value)}
                className={styles.colorPicker}
                title="Better Color"
              />
              <span className={styles.labelText}>Better</span>
            </div>
            <div className={styles.thresholdInputs}>
              <input
                type="number"
                value={betterMin}
                onChange={(e) => setBetterMin(e.target.value)}
                className={styles.percentInput}
                min="0"
                max="100"
                step="1"
              />
              <span className={styles.unit}>%</span>
              <span className={styles.operator}>-</span>
              <input
                type="number"
                value={betterMax}
                onChange={(e) => setBetterMax(e.target.value)}
                className={styles.percentInput}
                min="0"
                max="100"
                step="1"
              />
              <span className={styles.unit}>%</span>
            </div>
          </div>

          {/* Best */}
          <div className={styles.thresholdRow}>
            <div className={styles.thresholdLabel}>
              <input
                type="color"
                value={colorBest}
                onChange={(e) => setColorBest(e.target.value)}
                className={styles.colorPicker}
                title="Best Color"
              />
              <span className={styles.labelText}>Best</span>
            </div>
            <div className={styles.thresholdInputs}>
              <span className={styles.operator}>≥</span>
              <input
                type="number"
                value={bestMin}
                onChange={(e) => setBestMin(e.target.value)}
                className={styles.percentInput}
                min="0"
                max="100"
                step="1"
              />
              <span className={styles.unit}>%</span>
            </div>
          </div>
        </div>

            {/* Actions */}
            <div className={styles.actions}>
              {/* Temporary fix button - remove after purple is fixed */}
              {colorBest !== '#7c3aed' && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleFixPurple}
                  disabled={isSaving}
                  style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none' }}
                >
                  🔧 Fix Purple Color
                </Button>
              )}
              <Button
                variant="secondary"
                size="md"
                onClick={handleReset}
                disabled={isSaving}
              >
                Reset to Defaults
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                loading={isSaving}
                disabled={isSaving}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Reporting Preferences Section */}
      <div className={styles.settingsSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setReportingSectionExpanded(!reportingSectionExpanded)}
        >
          <div className={styles.sectionHeaderLeft}>
            <span className={styles.sectionIcon}>📊</span>
            <div className={styles.sectionHeaderContent}>
              <h2 className={styles.sectionTitle}>Reporting Preferences</h2>
              <p className={styles.sectionSubtitle}>
                Default settings for reports
              </p>
            </div>
          </div>
          <span className={`${styles.expandIcon} ${reportingSectionExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>

        <div className={`${styles.sectionContent} ${reportingSectionExpanded ? styles.expanded : ''}`}>
          <div className={styles.sectionInner}>
            <p className={styles.sectionDescription}>
              Configure default date ranges and what data to include in reports.
            </p>

            <div className={styles.formGrid}>
              {/* Date Range */}
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="default-date-range">
                  Default Report Date Range
                </label>
                <select
                  id="default-date-range"
                  value={defaultReportDateRange}
                  onChange={(e) => setDefaultReportDateRange(e.target.value)}
                  className={styles.select}
                >
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="last_quarter">Last Quarter</option>
                  <option value="ytd">Year to Date</option>
                  <option value="last_year">Last Year</option>
                  <option value="all_time">All Time</option>
                </select>
              </div>

              {/* Include Deleted Records */}
              <div className={styles.formField}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={includeDeletedInReports}
                    onChange={(e) => setIncludeDeletedInReports(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>Include deleted records in reports</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CPGSettings;
