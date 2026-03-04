/**
 * Design System Tokens
 *
 * Centralized design tokens for consistent styling across the application.
 * Used throughout CPU Tracker and other CPG components.
 */

export const colors = {
  // Brand Colors
  primary: '#4b006e',
  primaryLight: '#6b21a8',
  primaryLighter: '#8b5cf6',
  primaryBackground: '#f3e8ff',
  primaryBackgroundLight: '#f8f4fc',

  // Grays
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Semantic Colors
  success: '#10b981',
  successLight: '#d1fae5',
  successDark: '#047857',

  warning: '#f59e0b',
  warningLight: '#fef3c7',
  warningDark: '#d97706',

  error: '#ef4444',
  errorLight: '#fee2e2',
  errorDark: '#991b1b',

  info: '#3b82f6',
  infoLight: '#dbeafe',
  infoDark: '#1e40af',

  // Chart/Data Viz
  chartGreen: '#10b981',
  chartRed: '#ef4444',
  chartYellow: '#fbbf24',
  chartBlue: '#3b82f6',
  chartPurple: '#8b5cf6',
  chartOrange: '#f97316',

  // Component Specific
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  borderDark: '#d1d5db',

  background: '#ffffff',
  backgroundSecondary: '#f9fafb',
  backgroundTertiary: '#f3f4f6',

  text: '#1f2937',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
} as const;

export const spacing = {
  // Core spacing scale (rem)
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  xxl: '3rem',    // 48px

  // Specific use cases
  cardPadding: '1rem',
  sectionGap: '1.5rem',
  filterGap: '0.75rem',
  buttonGap: '0.75rem',
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const fontSize = {
  // Type scale
  xs: '0.75rem',     // 12px
  sm: '0.875rem',    // 14px
  base: '1rem',      // 16px
  lg: '1.125rem',    // 18px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '2rem',     // 32px

  // Semantic naming
  caption: '0.75rem',
  body: '1rem',
  bodySmall: '0.875rem',
  heading: '1.25rem',
  headingLarge: '1.5rem',
  display: '2rem',
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.6,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
  purple: '0 4px 12px rgba(75, 0, 110, 0.1)',
} as const;

export const transitions = {
  fast: '150ms ease-out',
  normal: '200ms ease-out',
  slow: '300ms ease-out',
} as const;

// Date Range Presets (standardized across all tabs)
export type DateRangePreset = '3mo' | '6mo' | '12mo' | 'last-calendar-year' | 'this-calendar-year' | 'custom' | 'all';

export const dateRangeOptions: { value: DateRangePreset; label: string }[] = [
  { value: '3mo', label: 'Last 3 Months' },
  { value: '6mo', label: 'Last 6 Months' },
  { value: '12mo', label: 'Last 12 Months' },
  { value: 'last-calendar-year', label: 'Last Calendar Year (2025)' },
  { value: 'this-calendar-year', label: 'This Calendar Year (2026)' },
  { value: 'custom', label: 'Custom Range' },
  { value: 'all', label: 'All Time' },
];

// Helper function to calculate date range
export function getDateRangeFromPreset(preset: DateRangePreset): { start: string; end: string } {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];

  switch (preset) {
    case '3mo':
      return {
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: endDate,
      };
    case '6mo':
      return {
        start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: endDate,
      };
    case '12mo':
      return {
        start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: endDate,
      };
    case 'last-calendar-year':
      return {
        start: '2025-01-01',
        end: '2025-12-31',
      };
    case 'this-calendar-year':
      return {
        start: '2026-01-01',
        end: '2026-12-31',
      };
    case 'all':
      return {
        start: '2020-01-01',
        end: endDate,
      };
    case 'custom':
      return {
        start: '',
        end: '',
      };
  }
}
