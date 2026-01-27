# CPG Data Clear Utility - Complete Implementation

## Summary

A complete utility system for clearing all CPG (Consumer Packaged Goods) data from the Graceful Books application. This is useful for:
- Starting fresh after demos
- Resetting test data
- Clearing sample data before production use

## Files Created

### 1. Core Utility
- **C:\Users\Admin\graceful_books\src\utils\clearCPGData.ts**
  - `clearAllCPGData(companyId)` - Clears all CPG data
  - `getCPGDataCounts(companyId)` - Counts current CPG data
  - Automatically registers browser console commands
  - **✅ Tests passing** (7/7 tests pass)

### 2. React Component (Optional)
- **C:\Users\Admin\graceful_books\src\components\cpg\DevClearDataTool.tsx**
  - Visual UI with buttons for checking counts and clearing data
  - Confirmation dialog to prevent accidents
  - Real-time display of deletion results

- **C:\Users\Admin\graceful_books\src\components\cpg\DevClearDataTool.module.css**
  - Professional styling with warning colors
  - Responsive layout

### 3. Tests
- **C:\Users\Admin\graceful_books\src\utils\clearCPGData.test.ts**
  - Comprehensive test coverage
  - ✅ All 7 tests passing
  - Tests clearing, counting, error handling, and logging

### 4. Integration
- **Updated: C:\Users\Admin\graceful_books\src\main.tsx**
  - Added import to register console commands on app load

### 5. Documentation
- **CPG_DATA_CLEAR_INSTRUCTIONS.md** - Detailed instructions
- **CLEAR_CPG_DATA_QUICK_START.md** - Quick start guide
- **clear-cpg-data.html** - HTML reference guide
- **README_CPG_DATA_CLEAR.md** - This file

## Quick Usage

### Method 1: Browser Console (Recommended)

1. Start dev server: `npm run dev`
2. Open app in browser and login
3. Open DevTools (F12) → Console tab
4. Run:

```javascript
// One-liner to clear everything
window.clearCPGData(window.getCompanyId()).then(r => console.log('✅ Cleared:', r));

// Or step-by-step:
const companyId = window.getCompanyId();
console.log('Company ID:', companyId);

// Check current data (optional)
await window.getCPGDataCounts(companyId);

// Clear all CPG data
await window.clearCPGData(companyId);
```

### Method 2: Add UI to Dashboard

Edit **src/pages/cpg/CPGDashboard.tsx**:

```typescript
import { DevClearDataTool } from '../../components/cpg/DevClearDataTool';

// Add in JSX:
<DevClearDataTool />
```

## What Gets Cleared

✓ CPG Categories
✓ Finished Products
✓ Recipes (Bills of Materials)
✓ Invoices
✓ Distributors
✓ Distribution Calculations
✓ Sales Promos
✓ Product Links
✓ Standalone Financials
✓ SKU Count Trackers

**Safe:** Does NOT affect accounting data, user auth, or other companies

## Browser Console Commands

```javascript
// Get your company ID
window.getCompanyId()

// Check data counts
window.getCPGDataCounts(companyId)

// Clear all CPG data
window.clearCPGData(companyId)
```

## Example Output

```javascript
> window.clearCPGData(window.getCompanyId())

🗑️ Clearing all CPG data for company: company_123abc
✅ Cleared CPG data: {
  categoriesDeleted: 15,
  productsDeleted: 8,
  recipesDeleted: 12,
  invoicesDeleted: 45,
  distributorsDeleted: 3,
  distributionCalculationsDeleted: 20,
  salesPromosDeleted: 5,
  productLinksDeleted: 8,
  standaloneFinancialsDeleted: 6,
  skuCountTrackersDeleted: 10
}
```

## Testing

Run tests:
```bash
npm test -- src/utils/clearCPGData.test.ts
```

Results: ✅ 7/7 tests passing
- Clears data correctly
- Returns proper counts
- Handles errors gracefully
- Logs operations
- Registers browser functions

## Architecture

The utility:
1. Uses Dexie.js queries to filter by company_id
2. Calls `.delete()` on each CPG table
3. Returns counts of deleted records
4. Logs operations to console
5. Handles errors with try/catch
6. Auto-registers to window object for console access

## Safety Features

- ✅ Only clears specified company's data
- ✅ Confirmation dialog in UI component
- ✅ Clear console logging of operations
- ✅ Error handling and reporting
- ✅ No effect on other data types
- ✅ Returns detailed deletion counts

## Integration Status

✅ Utility created and tested
✅ Tests passing (7/7)
✅ Browser console commands registered
✅ Documentation complete
✅ Optional UI component ready
⏳ Ready to use - just run the console command

## Next Steps

To use right now:

1. Make sure dev server is running: `npm run dev`
2. Open http://localhost:5173 in browser
3. Login to the app
4. Open browser console (F12)
5. Run: `window.clearCPGData(window.getCompanyId())`

## Troubleshooting

**"clearCPGData is not a function"**
- Refresh page
- Check console for import errors

**"No company ID found"**
- Make sure you're logged in
- Check: `localStorage.getItem('graceful_books_user')`

**Tests failing?**
- Run: `npm test -- src/utils/clearCPGData.test.ts`
- Check for database mock issues

## Additional Resources

- See **CLEAR_CPG_DATA_QUICK_START.md** for quick reference
- See **CPG_DATA_CLEAR_INSTRUCTIONS.md** for detailed usage
- Open **clear-cpg-data.html** in browser for interactive guide

---

**Status:** ✅ Complete and ready to use
**Tests:** ✅ 7/7 passing
**Integration:** ✅ Auto-loads with app
**Documentation:** ✅ Complete

Just open your browser console and run the command!
