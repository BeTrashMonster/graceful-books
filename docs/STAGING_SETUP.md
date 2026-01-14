# Staging Environment Setup Guide

Quick reference for setting up the staging environment for the first time.

## Prerequisites

- GitHub repository with push access
- Vercel account (free tier works)
- Node.js 18+ installed locally

## Setup Steps

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### 3. Link Project to Vercel

```bash
# In project root directory
vercel link
```

When prompted:
- Select your Vercel scope/organization
- Confirm project name: `graceful-books`
- Confirm directory: `./`

This creates `.vercel/project.json` with your project IDs.

### 4. Get Vercel Credentials

```bash
# Get Organization ID
cat .vercel/project.json | grep orgId

# Get Project ID
cat .vercel/project.json | grep projectId

# Create a Vercel token
# Go to: https://vercel.com/account/tokens
# Click "Create Token"
# Name it "GitHub Actions"
# Copy the token (you'll only see it once!)
```

### 5. Add GitHub Secrets

Go to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

Add these three secrets:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `VERCEL_TOKEN` | `[token]` | From Vercel tokens page |
| `VERCEL_ORG_ID` | `[orgId]` | From `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `[projectId]` | From `.vercel/project.json` |

### 6. Configure Staging Environment Variables in Vercel

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your project: `graceful-books`
3. Go to **Settings → Environment Variables**
4. Add these variables for **Preview** environment:

```
NODE_ENV = staging
VITE_APP_ENV = staging
VITE_DB_NAME = graceful-books-staging
VITE_DB_VERSION = 2
VITE_ENABLE_DEBUG_TOOLS = true
VITE_ENABLE_CONSOLE_LOGS = true
VITE_ENABLE_PERFORMANCE_MONITORING = true
VITE_COMMUNICATION_STYLE = steadiness
VITE_ENABLE_ANIMATIONS = true
VITE_ENABLE_CONFETTI = true
```

**Important:** Select "Preview" as the environment for all staging variables.

### 7. Test Deployment

```bash
# Trigger staging deployment by pushing to main
git checkout main
git pull
git push

# Watch deployment
# GitHub: Actions tab → Deploy to Staging
# Vercel: Dashboard → Deployments
```

### 8. Verify Deployment

Once deployed:

1. **Get staging URL:**
   - Check GitHub Actions logs (last step shows URL)
   - Check Vercel dashboard → Deployments → Latest deployment

2. **Test staging app:**
   - Open staging URL in browser
   - Open DevTools → Console (should see debug logs)
   - Open DevTools → Application → IndexedDB
   - Verify database name is `graceful-books-staging`
   - Create a test transaction
   - Verify data persists after refresh

3. **Verify environment:**
   - App should show "staging" indicator (if implemented)
   - Debug tools should be available
   - Console logs should be visible

## Troubleshooting Setup

### "vercel: command not found"

**Solution:** Restart terminal or add npm global bin to PATH:

```bash
# Check where global packages are installed
npm config get prefix

# Add to PATH (example for bash)
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### "Error: No framework detected"

**Solution:** Vercel should auto-detect Vite. If not, ensure `vercel.json` is committed:

```bash
git add vercel.json
git commit -m "Add Vercel configuration"
git push
```

### "VERCEL_TOKEN is invalid"

**Solution:** Token may have expired or been miscopied:

1. Go to https://vercel.com/account/tokens
2. Delete old token
3. Create new token
4. Update `VERCEL_TOKEN` secret in GitHub
5. Re-run deployment workflow

### ".vercel directory not created"

**Solution:** Run `vercel link` again and ensure you're in project root:

```bash
cd /path/to/graceful_books
vercel link
```

### "Deployment succeeds but app doesn't work"

**Solution:** Check environment variables:

1. Verify all `VITE_*` variables are set in Vercel (must start with `VITE_`)
2. Redeploy (variables don't apply retroactively)
3. Check browser console for errors
4. Check Vercel function logs (if using functions)

## Next Steps

After staging is set up:

- [ ] Configure production environment (see DEPLOYMENT.md)
- [ ] Set up custom domain (optional)
- [ ] Configure notifications for deployment failures
- [ ] Document staging URL for team
- [ ] Add staging link to project README

## Quick Reference

### Deploy to Staging

```bash
# Automatic
git push origin main

# Manual (via GitHub UI)
Actions → Deploy to Staging → Run workflow
```

### View Staging URL

```bash
# Via Vercel CLI
vercel ls

# Or check latest deployment
vercel inspect [deployment-url]
```

### Rollback Staging

```bash
# Via Vercel Dashboard
Deployments → Select previous deployment → Promote
```

---

**Setup Time:** ~15 minutes
**Last Updated:** 2026-01-14
