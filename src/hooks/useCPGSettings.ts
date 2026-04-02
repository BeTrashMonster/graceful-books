/**
 * useCPGSettings Hook
 *
 * Provides CPG settings throughout the application with automatic formatting utilities.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../db/database';
import type { CPGSettings } from '../db/schema/cpg.schema';
import { CPGSettingsService } from '../services/cpg/cpgSettings.service';

export function useCPGSettings() {
  const { companyId, deviceId } = useAuth();
  const [settings, setSettings] = useState<CPGSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !deviceId) {
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const service = new CPGSettingsService(db);
        const loadedSettings = await service.getOrCreateSettings(companyId, deviceId);
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Failed to load CPG settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Listen for settings updates
    const handleSettingsUpdate = () => {
      loadSettings();
    };

    window.addEventListener('cpg-settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('cpg-settings-updated', handleSettingsUpdate);
    };
  }, [companyId, deviceId]);

  /**
   * Format currency based on settings
   */
  const formatCurrency = (value: number): string => {
    if (!settings) return `$${value.toFixed(2)}`;

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
  };

  /**
   * Format number based on settings
   */
  const formatNumber = (value: number): string => {
    if (!settings) return value.toFixed(2);

    return value.toLocaleString(settings.number_format, {
      minimumFractionDigits: settings.decimal_places_numbers,
      maximumFractionDigits: settings.decimal_places_numbers,
    });
  };

  /**
   * Format percentage based on settings
   */
  const formatPercentage = (value: number): string => {
    if (!settings) return `${value.toFixed(2)}%`;

    const formatted = value.toLocaleString(settings.number_format, {
      minimumFractionDigits: settings.decimal_places_percentage,
      maximumFractionDigits: settings.decimal_places_percentage,
    });

    return `${formatted}%`;
  };

  /**
   * Format date based on settings
   */
  const formatDate = (date: Date | string | number): string => {
    if (!settings) return new Date(date).toLocaleDateString('en-US');

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
  };

  return {
    settings,
    isLoading,
    formatCurrency,
    formatNumber,
    formatPercentage,
    formatDate,
  };
}
