# Deployment Guide

This document explains how to deploy Graceful Books to staging and production environments.

## Table of Contents

- [Overview](#overview)
- [Staging Environment](#staging-environment)
- [Production Environment](#production-environment)
- [Environment Variables](#environment-variables)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Overview

Graceful Books uses Vercel for hosting with automatic deployments:

- **Staging:** Deploys automatically on push to `main` branch
- **Production:** Deploys on release tags or manual workflow dispatch

### Architecture

```
Local Development → Git Push → GitHub Actions → Vercel → Live URL
```

## Staging Environment

### Initial Setup

1. **Create Vercel Project:**
   ```bash
   # Install Vercel CLI
   npm install -g vercel

   # Login to Vercel
   vercel login

   # Link project
   vercel link
   ```

2. **Configure GitHub Secrets:**

   Go to your GitHub repository Settings → Secrets and variables → Actions, and add:

   - `VERCEL_TOKEN`: Your Vercel authentication token
     - Get from: https://vercel.com/account/tokens

   - `VERCEL_ORG_ID`: Your Vercel organization ID
     - Get from: `vercel link` or `.vercel/project.json`

   - `VERCEL_PROJECT_ID`: Your Vercel project ID
     - Get from: `vercel link` or `.vercel/project.json`

3. **Configure Environment Variables in Vercel:**

   In Vercel Dashboard → Project Settings → Environment Variables, add variables from `.env.staging.example`:

   ```
   NODE_ENV=staging
   VITE_APP_ENV=staging
   VITE_DB_NAME=graceful-books-staging
   VITE_ENABLE_DEBUG_TOOLS=true
   VITE_ENABLE_CONSOLE_LOGS=true
   ```

   Select **Preview** environment for staging variables.

### Automatic Deployment

Every push to `main` branch automatically deploys to staging:

```bash
git checkout main
git merge feature-branch
git push origin main
# GitHub Actions automatically deploys to Vercel staging
```

Watch deployment progress:
- GitHub: Actions tab → "Deploy to Staging" workflow
- Vercel: Dashboard → Deployments

### Manual Deployment

To manually trigger staging deployment:

```bash
# Via GitHub
# Go to Actions → Deploy to Staging → Run workflow

# Or via Vercel CLI
vercel --token=$VERCEL_TOKEN
```

### Accessing Staging

Staging URL format: `https://graceful-books-[random].vercel.app`

- URL is displayed in GitHub Actions logs
- URL is shown in Vercel dashboard
- URL is posted as PR comment (if triggered by PR)

### Staging Data Isolation

Staging uses a separate IndexedDB database (`graceful-books-staging`) to ensure:
- No interference with local development data
- No interference with production data
- Safe testing of migrations and schema changes

## Production Environment

### Deployment Methods

**Method 1: Release Tag (Recommended)**

```bash
# Create and push a release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Create GitHub Release
# Go to Releases → Draft a new release → Select tag → Publish
```

**Method 2: Manual Workflow Dispatch**

1. Go to GitHub Actions
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Type `deploy-to-production` to confirm
5. Click "Run workflow"

### Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] E2E tests pass (`npm run e2e`)
- [ ] Staging deployment tested and verified
- [ ] Security audit complete (`npm audit`)
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Production Configuration

In Vercel Dashboard → Project Settings → Environment Variables, add production variables:

```
NODE_ENV=production
VITE_APP_ENV=production
VITE_DB_NAME=graceful-books
VITE_ENABLE_DEBUG_TOOLS=false
VITE_ENABLE_CONSOLE_LOGS=false
VITE_ERROR_TRACKING_ENABLED=true
```

Select **Production** environment for these variables.

### Production Safeguards

The production workflow includes:
- Type checking before deployment
- Linting before deployment
- Full test suite execution
- Manual confirmation required for workflow dispatch
- No automatic deployments (only releases or manual)

### Accessing Production

Production URL: `https://gracefulbooks.com` (or your custom domain)

Configure custom domain in Vercel:
1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS records as instructed

## Environment Variables

### Required Variables

| Variable | Staging | Production | Description |
|----------|---------|------------|-------------|
| `NODE_ENV` | staging | production | Node environment |
| `VITE_APP_ENV` | staging | production | App environment identifier |
| `VITE_DB_NAME` | graceful-books-staging | graceful-books | IndexedDB database name |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ENABLE_DEBUG_TOOLS` | false | Enable React DevTools, etc. |
| `VITE_ENABLE_CONSOLE_LOGS` | false | Enable console logging |
| `VITE_ENABLE_ANIMATIONS` | true | Enable UI animations |
| `VITE_COMMUNICATION_STYLE` | steadiness | Default communication style |

### Managing Variables

**Via Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add/edit variables
3. Select environment (Preview/Production)
4. Redeploy to apply changes

**Via Vercel CLI:**
```bash
vercel env add VITE_NEW_VARIABLE
vercel env ls
vercel env rm VITE_OLD_VARIABLE
```

## Rollback Procedures

### Instant Rollback (Vercel)

Vercel keeps all previous deployments. To rollback:

1. Go to Vercel Dashboard → Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"
4. Confirm promotion

This instantly switches production to the selected deployment.

### Git Rollback

If needed, rollback via Git:

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit (careful!)
git reset --hard <commit-hash>
git push origin main --force
```

### Emergency Rollback

In case of critical issues:

1. **Immediate:** Use Vercel instant rollback (above)
2. **Communication:** Notify team via chosen channel
3. **Investigation:** Debug in staging, not production
4. **Fix:** Create hotfix branch, test in staging, deploy
5. **Post-mortem:** Document what happened and prevention

## Troubleshooting

### Deployment Fails with "Build Error"

**Symptoms:** GitHub Actions fails during build step

**Solutions:**
1. Check TypeScript errors: `npm run type-check`
2. Check linting errors: `npm run lint`
3. Verify all dependencies installed: `npm ci`
4. Check build locally: `npm run build`
5. Review GitHub Actions logs for specific error

### Staging URL Not Accessible

**Symptoms:** Deployment succeeds but URL returns 404 or 500

**Solutions:**
1. Verify `vercel.json` rewrites configuration
2. Check Vercel build logs for errors
3. Verify environment variables in Vercel dashboard
4. Check browser console for JavaScript errors
5. Test with Vercel CLI: `vercel dev`

### Environment Variables Not Applied

**Symptoms:** App behaves incorrectly, features not working

**Solutions:**
1. Verify variables set in Vercel for correct environment (Preview/Production)
2. Check variable names start with `VITE_` (required for Vite)
3. Redeploy after adding variables (variables don't apply retroactively)
4. Check variables are not overridden in code

### GitHub Actions "Unauthorized" Error

**Symptoms:** Deployment fails with Vercel authentication error

**Solutions:**
1. Verify `VERCEL_TOKEN` secret is set in GitHub
2. Check token hasn't expired (regenerate if needed)
3. Verify `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` are correct
4. Re-run `vercel link` locally and update secrets

### Slow Deployment Times

**Symptoms:** Deployment takes >5 minutes

**Solutions:**
1. Check if dependencies are cached (enable cache in GitHub Actions)
2. Verify `.vercelignore` excludes unnecessary files
3. Optimize bundle size (check `vite build` output)
4. Consider Vercel plan upgrade for faster builds

### Database Issues in Staging

**Symptoms:** Data not persisting or schema errors

**Solutions:**
1. Verify `VITE_DB_NAME` is set to `graceful-books-staging`
2. Clear IndexedDB in browser: DevTools → Application → IndexedDB
3. Check for schema migration errors in console
4. Verify Dexie.js version matches across environments

## Support

For deployment issues:
1. Check Vercel status: https://www.vercel-status.com/
2. Review Vercel documentation: https://vercel.com/docs
3. Check GitHub Actions logs for detailed error messages
4. Contact DevOps team (if applicable)

---

**Last Updated:** 2026-01-14
**Maintained by:** Engineering Team
