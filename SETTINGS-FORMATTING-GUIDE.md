# CPG Settings Formatting Guide

## ✅ What's Already Done

1. **CPGSettingsContext** - Global provider that loads settings once at app level
2. **cpgFormatting utility** - Can be imported anywhere for formatting
3. **Example component updated** - `CPUTrendsTab.tsx` now uses the utility

## 🎯 Current Status

- Settings save correctly ✅
- Settings load at app startup ✅
- One component (CPUTrendsTab) updated as example ✅
- **42 remaining files** need updating to use formatting utilities

## 🚀 Quick Fix for All Files

### Option 1: Use the Hook (For React Components)

```tsx
import { useCPGSettings } from '@/hooks/useCPGSettings';

function MyComponent() {
  const { formatCurrency, formatNumber, formatPercentage } = useCPGSettings();

  return <div>{formatCurrency(1.23)}</div>;
}
```

### Option 2: Use the Utility (For Any File)

```tsx
import { formatCurrency as $ } from '@/utils/cpgFormatting';

// Use like this:
const price = $(1.23); // Returns "$1.23" or "$1.2300" based on settings
```

## 📝 Files That Need Updating (43 total)

Run this search in VS Code to find all files:
```
Search: \$\{.*toFixed\(2\)\}
```

### Critical Files (User-Facing):
1. `src/pages/cpg/tabs/intelligence/CPUTrendsTab.tsx` - ✅ DONE
2. `src/pages/cpg/tabs/RawMaterialsTab.tsx` - Component invoices table
3. `src/components/cpg/CPUDisplay.tsx` - Product CPU cards
4. `src/components/cpg/SKUTracker.tsx` - SKU tracking table
5. `src/pages/cpg/Distribution.tsx` - Distribution analysis
6. `src/pages/cpg/tabs/DistributorCostsTab.tsx` - Distributor costs

### Quick Find & Replace Pattern

**Find (RegEx):**
```regex
\$\$\{([^}]+)\.toFixed\(2\)\}
```

**Replace:**
```
{$(${1})}
```

Then add this import at the top:
```tsx
import { formatCurrency as $ } from '@/utils/cpgFormatting';
```

## 🔧 How It Works

1. When the app loads, `CPGSettingsContext` loads settings from database
2. Settings are cached in `cpgFormatting.ts` for fast access
3. Any component can import formatting functions
4. When settings change, cache is cleared and reloaded
5. All formatting automatically uses user's preferences

## 📊 Your Current Settings

Based on your screenshot:
- `decimal_places_currency`: 2
- `decimal_places_numbers`: 4
- `decimal_places_percentage`: 3
- `currency_format`: USD
- `number_format`: en-US

So when you call:
- `formatCurrency(1.23)` → `"$1.23"`
- `formatNumber(1.23456)` → `"1.2346"` (4 decimal places)
- `formatPercentage(67.891)` → `"67.891%"` (3 decimal places)

## 🎨 Recommended Approach

1. **Test the current fix** - Go to CPU Tracker > Cost Intelligence > CPU Trends
   - The component prices should now show with your preferred decimal places

2. **If it works**, update remaining files using the pattern above:
   - Start with user-facing components (CPUDisplay, SKUTracker, Distribution)
   - Then update modal/report components
   - Finally update export/PDF functions

3. **Commit changes** as you go to track progress

## 💡 Pro Tip

For CSV/PDF exports, you may want raw numbers without currency symbols:
```tsx
const rawNumber = $(value).replace(/[$,]/g, ''); // Removes $ and commas
```

This preserves decimal place settings while making exports Excel-friendly.
