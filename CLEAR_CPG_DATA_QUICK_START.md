# Clear CPG Data - Quick Start Guide

I've created a utility to clear all CPG data for a fresh start. Here's how to use it:

## ✅ Files Created

1. **C:\Users\Admin\graceful_books\src\utils\clearCPGData.ts**
   - Main utility with `clearAllCPGData()` and `getCPGDataCounts()` functions
   - Automatically registers browser console commands

2. **C:\Users\Admin\graceful_books\src\components\cpg\DevClearDataTool.tsx**
   - Optional React component with UI buttons (can be added to dashboard)

3. **C:\Users\Admin\graceful_books\src\components\cpg\DevClearDataTool.module.css**
   - Styles for the component

4. **Updated: src\main.tsx** - Added import to register console commands

## 🚀 How to Use (Browser Console - Easiest Method)

### Step 1: Start Your Dev Server
```bash
npm run dev
```

### Step 2: Open Your Browser
- Navigate to http://localhost:5173 (or your dev server URL)
- Make sure you're **logged in** to the app

### Step 3: Open DevTools Console
- Press **F12** (or right-click > Inspect)
- Click the **Console** tab

### Step 4: Run the Clear Command

**Quick One-Liner:**
```javascript
window.clearCPGData(window.getCompanyId()).then(r => console.log('✅ Cleared:', r));
```

**Or Step-by-Step:**
```javascript
// 1. Get your company ID
const companyId = window.getCompanyId();
console.log('Company ID:', companyId);

// 2. Check current data (optional)
await window.getCPGDataCounts(companyId);

// 3. Clear all CPG data
await window.clearCPGData(companyId);
```

## 📊 What Gets Cleared

This clears ALL CPG data for your company:
- ✓ Categories
- ✓ Finished Products
- ✓ Recipes (BOMs)
- ✓ Invoices
- ✓ Distributors
- ✓ Distribution Calculations
- ✓ Sales Promos
- ✓ Product Links
- ✓ Standalone Financials
- ✓ SKU Count Trackers

**Does NOT clear:**
- ✗ Accounting data (transactions, accounts)
- ✗ User/auth data
- ✗ Other companies' data

## 🎨 Optional: Add UI Component to Dashboard

If you want a visual interface instead of using the console:

1. Edit **src/pages/cpg/CPGDashboard.tsx**

2. Add import at top:
   ```typescript
   import { DevClearDataTool } from '../../components/cpg/DevClearDataTool';
   ```

3. Add component in the JSX (e.g., after the header):
   ```typescript
   <DevClearDataTool />
   ```

This adds a yellow warning box with buttons to check counts and clear data.

## 🔧 Browser Console Commands Reference

```javascript
// Get company ID from localStorage
window.getCompanyId()

// Check how much data exists
window.getCPGDataCounts(companyId)

// Clear all CPG data
window.clearCPGData(companyId)
```

## ⚠️ Troubleshooting

**"getCompanyId is not a function"**
- Refresh the page to ensure utility loaded
- Check console for import errors

**"No company ID found"**
- Make sure you're logged in to the app
- Check: `localStorage.getItem('graceful_books_user')`

**Still having issues?**
- Restart dev server: `npm run dev`
- Clear browser cache
- Check browser console for detailed errors

## 📝 Example Output

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

## 📚 More Documentation

- **CPG_DATA_CLEAR_INSTRUCTIONS.md** - Detailed instructions
- **clear-cpg-data.html** - HTML guide you can open in browser

---

**Ready to clear your CPG data?** Just run the one-liner in your browser console! 🚀
