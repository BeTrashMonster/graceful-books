# CPG Quick Start Worksheet - Deployment Guide

## Quick Answer: YES, Option C Sets You Up Better for the Future! 🚀

### Why Option C (Separate React Mini-Site) is Better:

1. **Reusable After April 1** - Can become a permanent onboarding tool for new users
2. **Bulk Import Feature** - Can evolve into "Import from spreadsheet" for existing users
3. **Same Tech Stack** - React + TypeScript, easy to maintain alongside main app
4. **Independent Deployment** - Lives at audacious.money, doesn't touch unfinished software
5. **Better UX** - Proper state management, validation, interactive UI
6. **Maintainable** - Easy to update, extend, or modify in the future

---

## What You Have Now

✅ Standalone React mini-site in `/cpg-quickstart` folder
✅ Multi-step wizard (Welcome → Categories → Products → Recipes → Invoices → Review)
✅ Persistent summary panel (prevents confusion - shows everything they've entered)
✅ Auto-save to localStorage (draft saving)
✅ JSON export matching your database schema exactly
✅ Click to edit any section from anywhere
✅ Mobile responsive
✅ Production-ready build

---

## Testing Locally (RIGHT NOW)

The dev server is already running at:
**http://localhost:3001**

1. Open your browser to http://localhost:3001
2. Go through the wizard and test:
   - Add categories (try variants)
   - Add products
   - Add recipes (notice how dropdowns show categories you created)
   - Add invoices (optional)
   - Review page (click "Edit" buttons to jump back to any step)
   - Download JSON file
3. Check the summary panel on the right - click sections to jump around

---

## Deploying to audacious.money (Tomorrow Morning)

### Option 1: Netlify (Easiest - Recommended)

1. **Build the app**:
   ```bash
   cd cpg-quickstart
   npm run build
   ```

2. **Go to Netlify**:
   - Sign up at https://netlify.com (free)
   - Drag and drop the `dist/` folder
   - Done! You get a URL like `https://cpg-quickstart.netlify.app`

3. **Custom Domain** (optional):
   - In Netlify dashboard: Domain settings → Add custom domain
   - Point `audacious.money` to Netlify
   - Netlify handles HTTPS automatically

**Time: 5 minutes**

### Option 2: Your Existing Web Host

1. **Build the app**:
   ```bash
   cd cpg-quickstart
   npm run build
   ```

2. **Upload `dist/` folder** to your web server at audacious.money

3. **Configure web server**:
   - Serve `index.html` for all routes (SPA routing)
   - Example for Apache (`.htaccess`):
     ```apache
     <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteBase /
       RewriteRule ^index\.html$ - [L]
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteRule . /index.html [L]
     </IfModule>
     ```

**Time: 15-30 minutes**

### Option 3: GitHub Pages (Free)

1. **Build the app**:
   ```bash
   cd cpg-quickstart
   npm run build
   ```

2. **Push to GitHub**:
   - Create a new repo `cpg-quickstart`
   - Push the `dist/` folder to `gh-pages` branch

3. **Enable GitHub Pages**:
   - Repo settings → Pages → Source: gh-pages branch
   - You get `https://yourusername.github.io/cpg-quickstart`

**Time: 10 minutes**

---

## What Happens Next (Timeline)

### **Tomorrow (March 5)**
- Deploy to audacious.money
- Share URL with users
- Users can start filling it out

### **March 5 - April 1 (26 days)**
- Users work on their worksheets at their own pace
- Auto-saves to their browser localStorage
- They can come back anytime (same browser, same device)
- They download their JSON file when done

### **April 1**
- Software presentation
- Users upload their JSON files
- Full import into the software
- Everything they entered appears instantly

---

## Preventing User Confusion (Solved!)

You asked: "having categories in one section but needing to enter invoices in another, they might forget what they created"

### How We Solved This:

1. **Persistent Summary Panel** (right side):
   - Always visible
   - Shows everything they've entered
   - Click any section to edit
   - Example: "Categories (5)" with first 3 listed

2. **Visual Connections**:
   - When adding invoices, dropdown shows categories they already created
   - When adding recipes, dropdown shows categories they already created
   - Can't forget what they created - it's right in front of them

3. **Review Page**:
   - Shows everything in one place
   - "Edit" button for each section
   - Jumps back to that step instantly

4. **Progress Indicators**:
   - "You've created 5 categories, 3 products..."
   - Shows completion status for each step

---

## April 1 Import Process

### JSON Structure Matches Your Database Exactly

The exported JSON has:
```json
{
  "version": "1.0.0",
  "created_at": "2026-03-05T...",
  "categories": [...],
  "finished_products": [...],
  "recipes": [...],
  "invoices": [...]
}
```

### Import Logic (What You'll Build Later)

1. **Read JSON file** from user upload
2. **Replace temp IDs** with real UUIDs:
   - `temp-123` → `550e8400-e29b-41d4-a716-446655440000`
3. **Insert in order**:
   1. Categories first
   2. Products second (reference category IDs)
   3. Recipes third (reference product IDs + category IDs)
   4. Invoices last (reference category IDs)
4. **Show success**: "Imported 5 categories, 3 products, 3 recipes, 2 invoices"

---

## Future Enhancements (After April 1)

Since you chose Option C, you can easily:

1. **Keep it as permanent onboarding** for new users
2. **Add "Import from CSV"** feature using the same structure
3. **Share code/components** with main app
4. **Add "Edit Existing Data"** mode (not just create new)
5. **Add validation rules** (e.g., "Recipe must have at least 1 ingredient")
6. **Add bulk import** for power users

---

## File Structure

```
cpg-quickstart/
├── src/
│   ├── components/
│   │   ├── WelcomeStep.tsx
│   │   ├── CategoriesStep.tsx
│   │   ├── ProductsStep.tsx
│   │   ├── RecipesStep.tsx
│   │   ├── InvoicesStep.tsx
│   │   ├── ReviewStep.tsx
│   │   ├── SummaryPanel.tsx
│   │   └── SummaryPanel.css
│   ├── types/
│   │   └── index.ts (TypeScript interfaces)
│   ├── App.tsx (main wizard logic)
│   ├── App.css
│   └── main.tsx
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── DEPLOYMENT.md (this file)
```

---

## Support & Troubleshooting

### "Draft not saving"
- Check browser allows localStorage
- Not in private/incognito mode

### "Can't download JSON"
- Check browser allows downloads
- Popup blocker not blocking

### "Categories not showing in dropdown"
- Go back to Categories step first
- Add categories before products/recipes/invoices

### "Lost my data"
- Data stored in browser localStorage
- Must use same browser + same device
- Can't recover if cleared browser data

---

## Next Steps (Your Action Items)

1. ✅ **Test locally** at http://localhost:3001 (running now)
2. **Choose deployment method** (Netlify recommended)
3. **Deploy to audacious.money** (tomorrow morning)
4. **Share URL with users** (March 5)
5. **Build import logic** (by April 1)

---

## Questions?

The worksheet is production-ready and solves your confusion problem with the persistent summary panel and visual connections. Users can easily edit/change/craft it to their needs.

**Ready to deploy tomorrow!** 🚀
