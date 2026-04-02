# useCPGSettings Hook

## Overview

The `useCPGSettings` hook provides access to CPG settings and formatting utilities throughout the application. It automatically loads settings from the database and provides methods to format currencies, numbers, percentages, and dates according to user preferences.

## Usage

### Basic Usage

```tsx
import { useCPGSettings } from '../hooks/useCPGSettings';

function MyComponent() {
  const { settings, formatCurrency, formatNumber, formatPercentage, formatDate, isLoading } = useCPGSettings();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <p>Total: {formatCurrency(12345.67)}</p>
      <p>Quantity: {formatNumber(1234.5678)}</p>
      <p>Margin: {formatPercentage(67.89)}</p>
      <p>Date: {formatDate(new Date())}</p>
    </div>
  );
}
```

### Format Functions

#### `formatCurrency(value: number): string`
Formats a number as currency according to user's currency and decimal place preferences.

**Example:**
```tsx
formatCurrency(1234.56)  // Returns: "$1,234.56" (USD, 2 decimals)
formatCurrency(1234.56)  // Returns: "€1.234,56" (EUR, German locale)
```

#### `formatNumber(value: number): string`
Formats a number according to user's number format and decimal place preferences.

**Example:**
```tsx
formatNumber(1234.5678)  // Returns: "1,234.57" (US, 2 decimals)
formatNumber(1234.5678)  // Returns: "1.234,5678" (German, 4 decimals)
```

#### `formatPercentage(value: number): string`
Formats a number as a percentage according to user's number format and percentage decimal place preferences.

**Example:**
```tsx
formatPercentage(67.89)  // Returns: "67.89%" (2 decimals)
formatPercentage(67.89)  // Returns: "67.9%" (1 decimal)
```

#### `formatDate(date: Date | string | number): string`
Formats a date according to user's date format preference.

**Example:**
```tsx
formatDate(new Date('2026-04-02'))  // Returns: "04/02/2026" (MM/DD/YYYY)
formatDate('2026-04-02')             // Returns: "02/04/2026" (DD/MM/YYYY)
formatDate(1735689600000)            // Returns: "2026-04-02" (YYYY-MM-DD)
```

### Settings Object

The `settings` object contains all CPG settings including:

- **Display & Format Preferences:**
  - `currency_format`: Currency code (USD, EUR, GBP, etc.)
  - `date_format`: Date format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
  - `number_format`: Locale for number formatting (en-US, de-DE, fr-FR)
  - `decimal_places_currency`: Decimal places for currency (0-2)
  - `decimal_places_numbers`: Decimal places for numbers (0-4)
  - `decimal_places_percentage`: Decimal places for percentages (0-3)

- **Margin Quality Thresholds:**
  - `margin_gut_check_max`, `margin_good_min`, `margin_good_max`, etc.
  - Color settings for each quality level

- **Financial Defaults:**
  - `default_labor_rate`: Default hourly labor rate

- **Reporting Preferences:**
  - `default_report_date_range`: Default date range for reports
  - `include_deleted_in_reports`: Whether to include deleted records

## Auto-refresh on Settings Update

The hook automatically listens for `cpg-settings-updated` events and reloads settings when they change. When settings are saved in the Settings page, all components using this hook will automatically update.

## Using Without the Hook

If you need to format values in a service or utility function where hooks aren't available, use the `CPGSettingsService` directly:

```tsx
import { CPGSettingsService } from '../services/cpg/cpgSettings.service';
import { db } from '../db/database';

const service = new CPGSettingsService(db);
const settings = await service.getOrCreateSettings(companyId, deviceId);
const formatted = service.formatCurrency(1234.56, settings);
```

## Migration Guide

### Before (Hardcoded Formatting)

```tsx
function MyComponent() {
  const total = 1234.56;
  return <div>Total: ${total.toFixed(2)}</div>;
}
```

### After (Settings-aware Formatting)

```tsx
import { useCPGSettings } from '../hooks/useCPGSettings';

function MyComponent() {
  const { formatCurrency } = useCPGSettings();
  const total = 1234.56;
  return <div>Total: {formatCurrency(total)}</div>;
}
```

## Settings Update Flow

1. User changes settings in Settings page
2. Settings are saved to database via `CPGSettingsService`
3. `cpg-settings-updated` event is dispatched
4. All components using `useCPGSettings` automatically reload settings
5. Formatted values update to reflect new preferences
