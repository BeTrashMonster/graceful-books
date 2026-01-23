# Development Workflow SOP

**Standard Operating Procedure for Graceful Books Development & Testing**

Last Updated: 2026-01-23

---

## Overview

Graceful Books uses **Cloudflare Pages** for deployment with automatic CI/CD via GitHub Actions. Changes are automatically deployed when pushed to the `main` branch.

**Live URL:** https://graceful-books.pages.dev
**Custom Domain:** https://graceful-books.pages.dev (pending configuration fix - see CUSTOM_DOMAIN_FIX.md)

---

## Development Workflow

### 1. Making Code Changes

When Claude (or any developer) makes code changes:

```bash
# Changes are made to files in src/
# Example: src/components/wizards/ChartOfAccountsWizard.tsx
```

### 2. Committing Changes

After making changes, commit with a descriptive message:

```bash
git add -A
git commit -m "feat: Brief description of changes

Detailed description if needed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Commit Message Format:**
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### 3. Deploying to Production

Push to main branch to trigger automatic deployment:

```bash
git push origin main
```

**What happens next:**
1. GitHub Actions workflow triggers (`.github/workflows/deploy.yml`)
2. Code is built with `npm run build`
3. Built files are deployed to Cloudflare Pages
4. Deployment takes ~2-5 minutes
5. Changes go live at https://graceful-books.pages.dev

### 4. Monitoring Deployment

Check deployment status:
- GitHub Actions tab: https://github.com/BeTrashMonster/graceful-books/actions
- Look for green checkmark ✅ (success) or red X ❌ (failed)
- Deployment URL appears in workflow logs

---

## Testing Workflow

### Testing Changes on app.audacious.money

**IMPORTANT:** Always clear localStorage between tests to start fresh.

#### Method 1: Clear Wizard Progress Only (Recommended)

When testing wizard changes specifically:

```javascript
// Open browser console (F12 → Console tab)
Object.keys(localStorage).filter(k => k.includes('wizard')).forEach(k => localStorage.removeItem(k))
location.reload()
```

#### Method 2: Clear All Storage (Full Reset)

When you need a completely fresh start:

```javascript
// Open browser console (F12 → Console tab)
localStorage.clear()
location.reload(true)
```

#### Method 3: Delete IndexedDB (Reset All Data)

When you need to clear all saved data (accounts, transactions, etc.):

1. Press **F12** to open DevTools
2. Go to **Application** tab
3. Click **IndexedDB** in left sidebar
4. Right-click on the database → **Delete database**
5. Refresh the page (F5 or Ctrl+R)

### Verifying Changes

After deployment completes and you've cleared storage:

1. Open https://graceful-books.pages.dev
2. Clear localStorage using one of the methods above
3. Test the feature
4. Provide feedback on what works/doesn't work
5. Repeat as needed

---

## Local Development (Optional)

For faster iteration without deployments, you can run locally:

```bash
# Start local dev server
npm run dev

# Server starts on http://localhost:3000
# (or next available port: 3001, 3002, etc.)
```

**Note:** Local development is optional. The primary workflow uses app.audacious.money with automatic deployments.

---

## Common Issues & Solutions

### Issue: Changes not showing after deployment

**Root Cause:** Browser caching of JavaScript/CSS files. Fixed as of 2026-01-23 with addition of `public/_headers` file.

**Solution:**
1. Wait 2-5 minutes for deployment to complete
2. Check GitHub Actions for deployment status
3. Hard refresh (Ctrl+Shift+R) - should now work reliably
4. If still not working: Use incognito/private window as fallback
5. Check browser DevTools console for errors

**Note:** The `_headers` file ensures proper cache control headers are sent by Cloudflare Pages, making hard refresh work consistently.

### Issue: "Continue Guided Setup" appears when you want to start fresh

**Solution:**
```javascript
// Clear wizard progress
Object.keys(localStorage).filter(k => k.includes('wizard')).forEach(k => localStorage.removeItem(k))
location.reload()
```

### Issue: Old data still showing after wizard completion

**Solution:**
Delete IndexedDB:
1. F12 → Application → IndexedDB
2. Right-click database → Delete
3. Refresh page

### Issue: Deployment failing

**Check:**
1. GitHub Actions logs for error messages
2. TypeScript errors: `npm run type-check`
3. Lint errors: `npm run lint`
4. Test failures: `npm test`

---

## Deployment Environments

### Production
- **URL:** https://graceful-books.pages.dev
- **Branch:** `main`
- **Auto-deploy:** Yes (on push to main)
- **Provider:** Cloudflare Pages

### Staging (if needed)
- **Branch:** Create feature branch
- **Deploy:** Manual via workflow dispatch
- **Provider:** Vercel (configured in staging-deploy.yml)

---

## Quick Reference

### Clear wizard data and refresh:
```javascript
Object.keys(localStorage).filter(k => k.includes('wizard')).forEach(k => localStorage.removeItem(k)); location.reload()
```

### Clear all storage:
```javascript
localStorage.clear(); location.reload(true)
```

### Check deployment status:
https://github.com/BeTrashMonster/graceful-books/actions

### View live site:
https://graceful-books.pages.dev

---

## Notes

- **Always commit and push** for changes to appear on graceful-books.pages.dev
- **Deployment is automatic** - no manual build/deploy commands needed
- **Testing is immediate** after deployment completes (~2-5 min)
- **localStorage must be cleared** between wizard tests to start fresh
- **IndexedDB stores all data** - delete it to reset accounts/transactions

### About Custom Domain (app.audacious.money)

**Current Status:** The custom domain requires configuration fixes before it will receive automatic updates.

**For Development:** Use **graceful-books.pages.dev** - this always works perfectly and reflects latest deployment.

**Before Public Launch:** The custom domain needs proper Cloudflare configuration. See `CUSTOM_DOMAIN_FIX.md` for:
- DNS configuration (CNAME to graceful-books.pages.dev)
- Custom domain linking in Cloudflare Pages dashboard
- Automatic cache purge in deployment workflow
- Testing that updates appear on custom domain

---

*This SOP ensures consistent development and testing workflow for Graceful Books.*
