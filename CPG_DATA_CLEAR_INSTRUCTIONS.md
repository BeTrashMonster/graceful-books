# CPG Data Clear Utility - Instructions

This utility allows you to clear all CPG data for a fresh start during development and testing.

## Files Created

1. **C:\Users\Admin\graceful_books\src\utils\clearCPGData.ts**
   - Main utility functions for clearing and counting CPG data
   - Automatically registers browser console commands

2. **C:\Users\Admin\graceful_books\src\components\cpg\DevClearDataTool.tsx**
   - React component with UI for clearing data
   - Optional: Can be added to CPG Dashboard for visual access

3. **C:\Users\Admin\graceful_books\src\components\cpg\DevClearDataTool.module.css**
   - Styles for the DevClearDataTool component

## Usage Methods

### Method 1: Browser Console (Easiest)

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open your browser to the app (usually http://localhost:5173)

3. Open browser DevTools (F12 or right-click > Inspect)

4. In the Console tab, run these commands:

   ```javascript
   // Step 1: Get your company ID
   const companyId = window.getCompanyId();
   console.log('Company ID:', companyId);

   // Step 2: Check how much data you have (optional)
   window.getCPGDataCounts(companyId).then(counts => console.log('Data counts:', counts));

   // Step 3: Clear all CPG data
   window.clearCPGData(companyId).then(result => console.log('Cleared:', result));
   ```

### Method 2: Add UI Component to Dashboard (Optional)

If you want a visual interface for clearing data:

1. Edit **C:\Users\Admin\graceful_books\src\pages\cpg\CPGDashboard.tsx**

2. Add the import at the top:
   ```typescript
   import { DevClearDataTool } from '../../components/cpg/DevClearDataTool';
   ```

3. Add the component anywhere in the dashboard (e.g., after the header):
   ```typescript
   <DevClearDataTool />
   ```

4. The component will appear with buttons to check counts and clear data

## What Gets Cleared

The utility clears ALL CPG data for the specified company:

- Categories
- Finished Products
- Recipes (BOMs)
- Invoices
- Distributors
- Distribution Calculations
- Sales Promos
- Product Links
- Standalone Financials
- SKU Count Trackers

## Important Notes

- This action cannot be undone
- Only clears data for the specified company ID
- Does NOT affect:
  - Accounting data (transactions, accounts, etc.)
  - User authentication data
  - Other companies' data

## Quick Start (Copy & Paste)

Open your browser console and run this one-liner:

```javascript
window.clearCPGData(window.getCompanyId()).then(r => console.log('Cleared:', r));
```

## Verification

After clearing, verify the data is gone:

```javascript
window.getCPGDataCounts(window.getCompanyId()).then(counts => {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.log(`Total CPG records: ${total}`);
});
```

## Need to Re-seed Data?

After clearing, you can re-run your demo data seeding:

```javascript
// If you have a seed function, run it here
// Example: seedCPGDemoData()
```

## Troubleshooting

**Error: "No company ID found"**
- Make sure you're logged in
- Check localStorage: `localStorage.getItem('graceful_books_user')`

**Error: "clearCPGData is not a function"**
- Refresh the page to ensure the utility loaded
- Check the console for any import errors

**Data not clearing**
- Check the browser console for detailed error messages
- Verify the company ID is correct
- Ensure you have database access permissions
