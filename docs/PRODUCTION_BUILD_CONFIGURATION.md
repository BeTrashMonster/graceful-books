# Production Build Configuration Guide

This document explains the production build configuration for Audacious Money (Graceful Books) frontend.

## Overview

The production build system is configured to optimize bundle size, disable source maps for security, and use environment-specific settings via `.env.production`.

**Last Updated:** 2026-03-22
**Task:** R2 - Task 5.1: Production Build Configuration

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Build Configuration](#build-configuration)
- [API Configuration](#api-configuration)
- [Build Process](#build-process)
- [Security Checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)

---

## Environment Variables

### Production Environment File: `.env.production`

Location: `C:/Users/Admin/graceful_books/.env.production`

**Important:** This file is excluded from version control via `.gitignore`.

```bash
# API ENDPOINTS
VITE_API_URL=https://api.audacious.money
VITE_SYNC_URL=wss://sync.audacious.money

# STRIPE (Public key - safe for frontend)
VITE_STRIPE_PUBLIC_KEY=pk_live_PLACEHOLDER_GET_FROM_STRIPE_DASHBOARD

# APPLICATION
VITE_APP_NAME=Audacious Money
VITE_APP_ENV=production

# SECURITY
VITE_DEBUG_MODE=false
VITE_ANALYTICS_ENABLED=false
VITE_MOCK_API=false
VITE_DISABLE_ENCRYPTION=false
```

### Environment Variable Rules

1. **VITE_ Prefix Required:** Only variables prefixed with `VITE_` are exposed to the frontend
2. **HTTPS Only:** Production API URL must use `https://` (enforced by validation)
3. **WSS Only:** Production WebSocket URL must use `wss://` (enforced by validation)
4. **Public Keys Only:** Use Stripe public key (`pk_live_*`), NEVER secret key
5. **No Secrets:** Never put API secrets, database credentials, or private keys in frontend environment variables

### Required Configuration Before Deployment

**Before deploying to production, you MUST:**

1. **Get Stripe Live Key:**
   - Login to Stripe Dashboard (https://dashboard.stripe.com)
   - Go to Developers → API Keys
   - Copy the "Publishable key" (starts with `pk_live_`)
   - Replace `PLACEHOLDER_GET_FROM_STRIPE_DASHBOARD` in `.env.production`

2. **Verify API Endpoints:**
   - Ensure `https://api.audacious.money` points to your production backend
   - Ensure `wss://sync.audacious.money` points to your production sync relay

---

## Build Configuration

### Vite Configuration: `vite.config.ts`

The production build is optimized with the following settings:

```typescript
build: {
  outDir: 'dist',
  sourcemap: false, // Disable source maps in production for security
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'db-vendor': ['dexie', 'dexie-react-hooks'],
        'crypto': ['argon2-browser'], // Separate crypto library for caching
      },
    },
  },
}
```

### Key Configuration Decisions

1. **`sourcemap: false`**
   - **Why:** Source maps expose your source code structure to attackers
   - **Security:** Critical for zero-knowledge platform
   - **Trade-off:** Makes production debugging harder (use staging with source maps)

2. **`manualChunks`**
   - **Why:** Optimizes bundle splitting for better caching
   - **Benefits:**
     - React/router updates don't invalidate crypto bundle cache
     - Database library separate from UI code
     - Crypto library (large WASM) cached separately
   - **Result:** Faster updates, better cache hit rates

3. **`outDir: 'dist'`**
   - **Why:** Standard output directory for deployments
   - **Note:** Ensure `.gitignore` excludes `dist/`

---

## API Configuration

### Centralized API Config: `src/config/api.ts`

All API endpoints and external service URLs are configured via environment variables:

```typescript
// API base URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// WebSocket sync relay URL
export const SYNC_URL = import.meta.env.VITE_SYNC_URL || 'ws://localhost:8080';

// Stripe publishable key
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';
```

### Production Validation

The configuration includes automatic validation on module load:

```typescript
// Validates:
// - HTTPS for API_URL in production
// - WSS for SYNC_URL in production
// - Encryption not disabled
// - Mock API not enabled
// - Stripe key presence (warning if missing)
validateProductionConfig();
```

**If validation fails in production, the app will throw an error and halt execution.**

### Usage in Code

```typescript
// Import from centralized config
import { API_URL, SYNC_URL, apiConfig } from '@/config/api';

// Use in API calls
const response = await fetch(`${API_URL}/api/endpoint`);

// Check environment
if (apiConfig.isProduction) {
  // Production-only logic
}
```

---

## Build Process

### Building for Production

```bash
# Clean build
npm run build

# Build with production environment
npm run build:production
```

### Build Output

```
dist/
├── assets/
│   ├── react-vendor-[hash].js    # React, React DOM, Router
│   ├── db-vendor-[hash].js       # Dexie, IndexedDB
│   ├── crypto-[hash].js          # Argon2 (WASM)
│   ├── [component]-[hash].js     # Individual components
│   └── [component]-[hash].css    # Component styles
├── index.html
└── _headers                       # Security headers for hosting
```

### Bundle Size Verification

```bash
# Check bundle sizes
ls -lh dist/assets/

# Verify no source maps
ls dist/assets/*.map 2>/dev/null && echo "WARNING: Source maps found!" || echo "OK: No source maps"

# Verify no .env files
find dist/ -name ".env*" || echo "OK: No .env files in dist/"
```

### Preview Production Build Locally

```bash
# Build and preview
npm run build
npm run preview

# Opens http://localhost:4173
# Test with production environment variables
```

---

## Security Checklist

Before deploying to production, verify:

- [ ] **HTTPS API URL:** `VITE_API_URL` uses `https://`
- [ ] **WSS Sync URL:** `VITE_SYNC_URL` uses `wss://`
- [ ] **Stripe Public Key:** `VITE_STRIPE_PUBLIC_KEY` starts with `pk_live_` (not `sk_live_`)
- [ ] **Source Maps Disabled:** `sourcemap: false` in `vite.config.ts`
- [ ] **No .env in dist:** `.env` files excluded from build output
- [ ] **Encryption Enabled:** `VITE_DISABLE_ENCRYPTION=false`
- [ ] **Mock API Disabled:** `VITE_MOCK_API=false`
- [ ] **Debug Mode Off:** `VITE_DEBUG_MODE=false`
- [ ] **No Console Logs:** No `console.log` in production code (use logger)
- [ ] **Environment Variables in CI/CD:** Set in deployment platform (Vercel/Cloudflare Pages)

---

## Troubleshooting

### Build Fails with "WASM not supported"

**Problem:** Vite cannot bundle argon2-browser WASM files

**Solution:**
```bash
# Use vite-plugin-wasm or vite-plugin-top-level-await
npm install --save-dev vite-plugin-wasm vite-plugin-top-level-await
```

Update `vite.config.ts`:
```typescript
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  // ...
});
```

### Environment Variables Not Working

**Problem:** `import.meta.env.VITE_*` returns `undefined`

**Solutions:**
1. Ensure variable name starts with `VITE_`
2. Restart dev server after changing `.env` files
3. Check `.env.production` is in root directory (same level as `package.json`)
4. Verify build command uses `--mode production`
5. In deployment platform (Vercel/Cloudflare), set variables in dashboard

### Source Maps Still Generated

**Problem:** `.js.map` files in `dist/assets/`

**Solutions:**
1. Verify `sourcemap: false` in `vite.config.ts`
2. Clean build: `rm -rf dist && npm run build`
3. Check for conflicting vite config files
4. Ensure using latest build (old `dist/` from previous build)

### API URL Not Using HTTPS in Production

**Problem:** API calls go to `http://` instead of `https://`

**Solutions:**
1. Check `.env.production` has `VITE_API_URL=https://api.audacious.money`
2. Rebuild: `npm run build:production`
3. Verify build used production mode: check `import.meta.env.MODE`
4. Check browser console for validation errors from `src/config/api.ts`

### Stripe Key Not Working

**Problem:** Stripe payment fails or returns "Invalid key"

**Solutions:**
1. Verify using **Publishable Key** (starts with `pk_live_`)
2. Never use **Secret Key** (starts with `sk_live_`) in frontend
3. Check key hasn't been deleted in Stripe Dashboard
4. Verify key is for correct Stripe account
5. Test key with Stripe's test endpoint: `https://api.stripe.com/v1/tokens`

---

## Deployment Platforms

### Vercel

**Set environment variables in Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add all `VITE_*` variables from `.env.production`
3. Select **Production** environment
4. Redeploy to apply changes

**Build Command:** `npm run build`
**Output Directory:** `dist`

### Cloudflare Pages

**Set environment variables in Cloudflare Dashboard:**
1. Go to Workers & Pages → Your Project → Settings
2. Add all `VITE_*` variables from `.env.production`
3. Select **Production** environment
4. Redeploy to apply changes

**Build Command:** `npm run build`
**Output Directory:** `dist`

### Digital Ocean App Platform

**Set environment variables in App Settings:**
1. Go to Settings → App-Level Environment Variables
2. Add all `VITE_*` variables from `.env.production`
3. Encrypt sensitive values
4. Redeploy to apply changes

**Build Command:** `npm run build`
**Output Directory:** `dist`

---

## File Checklist

After running this task, verify these files exist:

```bash
# Environment configuration
.env.production                    # Production environment variables (git-ignored)

# Build configuration
vite.config.ts                     # Updated with sourcemap: false and manualChunks

# API configuration
src/config/api.ts                  # Centralized API config using environment variables
src/config/index.ts                # Exports API configuration

# Updated API client
src/api/syncApi.ts                 # Uses SYNC_URL and MOCK_API from config
```

---

## Next Steps

After completing production build configuration:

1. **Task 5.2:** Configure Content Security Policy headers
2. **Task 5.3:** Set up deployment pipeline (GitHub Actions or similar)
3. **Task 5.4:** Configure monitoring and error tracking (Sentry)
4. **Task 6.1:** Set up production database (Digital Ocean)
5. **Task 6.2:** Deploy backend to Digital Ocean App Platform

---

## References

- **Vite Production Build:** https://vitejs.dev/guide/build.html
- **Vite Environment Variables:** https://vitejs.dev/guide/env-and-mode.html
- **Stripe API Keys:** https://stripe.com/docs/keys
- **Security Best Practices:** `docs/SECURITY_GUIDELINES.md`

---

**Completed by:** Agent R2
**Date:** 2026-03-22
**Status:** ✅ Complete
