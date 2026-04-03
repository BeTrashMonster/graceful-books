/**
 * CPG Settings Context
 *
 * Provides global access to CPG settings and formatting functions.
 * Automatically loads settings and updates when settings change.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../db/database';
import type { CPGSettings } from '../db/schema/cpg.schema';
import { CPGSettingsService } from '../services/cpg/cpgSettings.service';
import { initializeCPGFormatting } from '../utils/cpgFormatting';

interface CPGSettingsContextValue {
  settings: CPGSettings | null;
  isLoading: boolean;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  formatPercentage: (value: number) => string;
  formatDate: (date: Date | string | number) => string;
}

const CPGSettingsContext = createContext<CPGSettingsContextValue | undefined>(undefined);

export function CPGSettingsProvider({ children }: { children: ReactNode }) {
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
        console.log('[CPGSettingsContext] Loaded settings:', {
          decimal_places_currency: loadedSettings.decimal_places_currency,
          decimal_places_numbers: loadedSettings.decimal_places_numbers,
          decimal_places_percentage: loadedSettings.decimal_places_percentage,
          currency_format: loadedSettings.currency_format,
          number_format: loadedSettings.number_format,
        });
        setSettings(loadedSettings);

        // Initialize global formatting utility cache
        await initializeCPGFormatting(companyId);
      } catch (error) {
        console.error('[CPGSettingsContext] Failed to load CPG settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Listen for settings updates
    const handleSettingsUpdate = () => {
      console.log('[CPGSettingsContext] Settings updated, reloading...');
      loadSettings();
    };

    window.addEventListener('cpg-settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('cpg-settings-updated', handleSettingsUpdate);
    };
  }, [companyId, deviceId]);

  const formatCurrency = (value: number): string => {
    if (!settings) {
      console.warn('[CPGSettingsContext] formatCurrency called but settings not loaded, using default');
      return `$${value.toFixed(2)}`;
    }

    const decimals = settings.decimal_places_currency;

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
    // Use exact decimal places - same for min and max
    const formatted = value.toLocaleString(settings.number_format, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return `${symbol}${formatted}`;
  };

  const formatNumber = (value: number): string => {
    if (!settings) return value.toFixed(2);

    return value.toLocaleString(settings.number_format, {
      minimumFractionDigits: 0,
      maximumFractionDigits: settings.decimal_places_numbers,
    });
  };

  const formatPercentage = (value: number): string => {
    if (!settings) return `${value.toFixed(2)}%`;

    const formatted = value.toLocaleString(settings.number_format, {
      minimumFractionDigits: 0,
      maximumFractionDigits: settings.decimal_places_percentage,
    });

    return `${formatted}%`;
  };

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

  const value: CPGSettingsContextValue = {
    settings,
    isLoading,
    formatCurrency,
    formatNumber,
    formatPercentage,
    formatDate,
  };

  return (
    <CPGSettingsContext.Provider value={value}>
      {children}
    </CPGSettingsContext.Provider>
  );
}

/**
 * Hook to access CPG settings and formatting functions
 */
export function useCPGSettingsContext() {
  const context = useContext(CPGSettingsContext);
  if (context === undefined) {
    throw new Error('useCPGSettingsContext must be used within a CPGSettingsProvider');
  }
  return context;
}
