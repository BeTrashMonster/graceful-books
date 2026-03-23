# Cloudflare Pages Deployment Guide

**Audacious Money - Frontend Deployment**
**Last Updated:** 2026-03-22

This guide provides step-by-step instructions for deploying the Audacious Money frontend to Cloudflare Pages.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cloudflare Pages Project Setup](#cloudflare-pages-project-setup)
3. [Build Configuration](#build-configuration)
4. [Environment Variables](#environment-variables)
5. [Custom Domain Configuration](#custom-domain-configuration)
6. [Security Headers Verification](#security-headers-verification)
7. [Branch Preview Deployments](#branch-preview-deployments)
8. [Testing Checklist](#testing-checklist)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

Before starting deployment, ensure you have:

- [ ] **Cloudflare account** - Sign up at https://dash.cloudflare.com/sign-up
- [ ] **GitHub repository** - Code pushed to GitHub (or GitLab/Bitbucket)
- [ ] **Domain name** - `audacious.money` added to Cloudflare DNS
- [ ] **Stripe account** - Live publishable key ready
- [ ] **Backend API deployed** - `https://api.audacious.money` operational
- [ ] **Sync relay deployed** - `wss://sync.audacious.money` operational
- [ ] **Production build tested locally** - Run `npm run build && npm run preview`

---

## Cloudflare Pages Project Setup

### Step 1: Create New Pages Project

1. Log into **Cloudflare Dashboard**: https://dash.cloudflare.com
2. Navigate to **Pages** in the left sidebar
3. Click **Create a project** button
4. Select **Connect to Git**

### Step 2: Connect Git Repository

1. **Choose Git provider**: GitHub (or GitLab/Bitbucket)
2. **Authorize Cloudflare** to access your repositories
3. **Select repository**: `audacious-money` (or your repo name)
4. Click **Begin setup**

### Step 3: Configure Build Settings

**Framework preset:** Select `Vite`

**Build command:**
```bash
npm run build
```

**Build output directory:**
```
dist
```

**Root directory (optional):**
```
/
```
Leave blank if frontend is in repository root. If using a monorepo, specify the frontend directory (e.g., `/frontend`).

**Environment variables:** Configure in next section before clicking **Save and Deploy**.

---

## Build Configuration

Cloudflare Pages will automatically detect Vite configuration from `vite.config.ts`. The build process:

1. Installs dependencies: `npm install`
2. Runs build command: `npm run build`
3. Outputs to `dist/` directory
4. Deploys static files from `dist/`

**Build settings verification:**

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Node.js version | 18.x (auto-detected) |

---

## Environment Variables

Environment variables are configured in **Cloudflare Pages settings** → **Environment variables**.

### Production Environment Variables

Add the following variables for **Production** environment:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `VITE_API_URL` | `https://api.audacious.money` | Backend API URL (HTTPS only) |
| `VITE_SYNC_URL` | `wss://sync.audacious.money` | WebSocket Sync Relay URL (WSS only) |
| `VITE_STRIPE_PUBLIC_KEY` | `pk_live_xxxxx` | Stripe **LIVE** publishable key |
| `VITE_APP_NAME` | `Audacious Money` | Application name |
| `VITE_APP_ENV` | `production` | Environment identifier |
| `VITE_DEBUG_MODE` | `false` | Disable debug mode |
| `VITE_ANALYTICS_ENABLED` | `false` | Enable analytics (optional) |
| `VITE_MOCK_API` | `false` | **MUST BE FALSE** in production |
| `VITE_DISABLE_ENCRYPTION` | `false` | **MUST BE FALSE** in production |

### Preview Environment Variables (Optional)

For branch preview deployments, configure **Preview** environment with staging values:

| Variable Name | Value |
|--------------|-------|
| `VITE_API_URL` | `https://staging-api.audacious.money` |
| `VITE_SYNC_URL` | `wss://staging-sync.audacious.money` |
| `VITE_STRIPE_PUBLIC_KEY` | `pk_test_xxxxx` (Stripe **TEST** key) |
| `VITE_APP_ENV` | `staging` |

### How to Add Environment Variables

1. In Cloudflare Pages project settings
2. Go to **Settings** → **Environment variables**
3. Click **Add variable**
4. Select environment: **Production** or **Preview**
5. Enter **Variable name** and **Value**
6. Click **Save**

**CRITICAL SECURITY NOTES:**

- **NEVER** use test Stripe keys in production
- **ALWAYS** use HTTPS for API URLs (not HTTP)
- **ALWAYS** use WSS for sync URLs (not WS)
- All `VITE_*` variables are exposed to the browser (public)
- Never store secrets or private keys in `VITE_*` variables

---

## Custom Domain Configuration

### Step 1: Add Custom Domain

1. In Cloudflare Pages project
2. Go to **Custom domains**
3. Click **Set up a custom domain**
4. Enter domain: `app.audacious.money`
5. Click **Continue**

### Step 2: DNS Configuration

Cloudflare will automatically configure DNS records:

**CNAME Record:**
```
app.audacious.money → [project-name].pages.dev
```

If DNS is managed by Cloudflare (recommended), this happens automatically. If DNS is external:

1. Log into your DNS provider
2. Add CNAME record:
   - **Name:** `app`
   - **Target:** `[project-name].pages.dev`
   - **TTL:** Automatic or 3600

### Step 3: SSL Certificate Verification

Cloudflare automatically provisions SSL certificates via Let's Encrypt.

**Verify SSL is active:**

1. Wait 2-5 minutes for certificate issuance
2. Visit `https://app.audacious.money`
3. Check browser shows padlock icon
4. Click padlock → **Connection is secure**
5. Certificate should be from **Cloudflare**

**Force HTTPS:**

Cloudflare Pages automatically redirects HTTP → HTTPS. No additional configuration needed.

---

## Security Headers Verification

Security headers are configured in `public/_headers` file and automatically applied by Cloudflare Pages.

### Headers Applied

The following security headers are configured:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | (see below) | Prevents XSS and data injection |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer disclosure |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Restricts browser features |

### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://js.stripe.com;
connect-src 'self' https://api.audacious.money wss://sync.audacious.money https://api.stripe.com;
img-src 'self' data: https:;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
frame-src https://js.stripe.com;
object-src 'none';
base-uri 'self';
form-action 'self'
```

**CSP Explanation:**

- `default-src 'self'` - Only load from same origin by default
- `script-src` - Allow scripts from self, inline scripts (React), and Stripe
- `connect-src` - Allow API calls to backend, sync relay, and Stripe
- `img-src` - Allow images from HTTPS sources
- `style-src` - Allow inline styles (required for React)
- `frame-src` - Allow Stripe iframes (for payment elements)
- `object-src 'none'` - Disallow plugins (Flash, Java, etc.)

### Verify Headers After Deployment

**Using curl:**

```bash
curl -I https://app.audacious.money
```

**Expected output includes:**
```
HTTP/2 200
content-security-policy: default-src 'self'; ...
x-frame-options: DENY
x-content-type-options: nosniff
strict-transport-security: max-age=31536000; includeSubDomains; preload
...
```

**Using browser DevTools:**

1. Open `https://app.audacious.money` in Chrome/Firefox
2. Open **DevTools** (F12)
3. Go to **Network** tab
4. Refresh page
5. Click on document request (first item)
6. Go to **Headers** tab
7. Verify **Response Headers** include all security headers

**Using online tools:**

- **Security Headers**: https://securityheaders.com/?q=https://app.audacious.money
  - Target grade: **A** or **A+**
- **Mozilla Observatory**: https://observatory.mozilla.org/analyze/app.audacious.money
  - Target score: **90+**

---

## Branch Preview Deployments

Cloudflare Pages automatically creates preview deployments for every branch and pull request.

### Enable Branch Previews

1. In Cloudflare Pages project settings
2. Go to **Settings** → **Builds & deployments**
3. Under **Preview deployments**, select:
   - **All branches** (recommended for development)
   - OR **Custom branches** (specify branch patterns)
4. Click **Save**

### Preview URL Format

Each preview gets a unique URL:

**Format:**
```
https://[branch-name].[project-name].pages.dev
```

**Example:**
```
Branch: feature/new-dashboard
URL: https://feature-new-dashboard.audacious-money.pages.dev
```

### Pull Request Comments

Cloudflare automatically comments on GitHub PRs with preview URLs:

```
✅ Deployment successful!

Preview URL: https://feature-xyz.audacious-money.pages.dev

Latest commit: abc123
```

### Preview Environment Variables

Preview deployments use **Preview** environment variables (configured earlier). This allows testing with staging backend and test Stripe keys.

---

## Testing Checklist

After deployment, verify the following:

### Basic Functionality

- [ ] **Site loads** at `https://app.audacious.money`
- [ ] **HTTPS enforced** - HTTP redirects to HTTPS
- [ ] **No console errors** in browser DevTools
- [ ] **Assets load** - Images, fonts, CSS, JavaScript
- [ ] **Favicon appears** in browser tab

### Authentication & API

- [ ] **Sign up flow works** - Create new account
- [ ] **Email verification** - Receive verification email
- [ ] **Login works** - Sign in with credentials
- [ ] **API calls succeed** - Check Network tab for 200 responses
- [ ] **WebSocket connects** - Sync relay connection established
- [ ] **Logout works** - Session cleared properly

### Payment Integration

- [ ] **Stripe loads** - Payment elements render
- [ ] **Test payment works** - Use test card `4242 4242 4242 4242`
- [ ] **Payment fails gracefully** - Error handling works
- [ ] **Stripe webhooks received** - Check backend logs

### Security

- [ ] **Security headers present** - Verify with curl or browser
- [ ] **CSP allows required resources** - No CSP errors in console
- [ ] **HTTPS only** - No mixed content warnings
- [ ] **No XSS vulnerabilities** - Run basic XSS tests
- [ ] **No exposed secrets** - Check source code in DevTools

### Performance

- [ ] **Page load < 3 seconds** - Measure with Lighthouse
- [ ] **Lighthouse score > 90** - Run Lighthouse audit
- [ ] **Assets cached properly** - Check Cache-Control headers
- [ ] **No 404 errors** - All assets load successfully

### Browser Compatibility

- [ ] **Chrome** (latest)
- [ ] **Firefox** (latest)
- [ ] **Safari** (latest)
- [ ] **Edge** (latest)
- [ ] **Mobile Safari** (iOS)
- [ ] **Chrome Mobile** (Android)

---

## Troubleshooting

### Build Failures

**Problem:** Build fails with "Command failed: npm run build"

**Solutions:**
1. Check **build logs** in Cloudflare Pages dashboard
2. Verify `package.json` has build script: `"build": "vite build"`
3. Ensure all dependencies are in `dependencies` (not `devDependencies`)
4. Test build locally: `npm run build`
5. Check Node.js version compatibility (Cloudflare uses 18.x)

**Problem:** Build succeeds but site doesn't load

**Solutions:**
1. Verify **Build output directory** is set to `dist`
2. Check `dist/` contains `index.html` after build
3. Verify `vite.config.ts` has `outDir: 'dist'`

### Environment Variable Issues

**Problem:** API calls fail with 404 or CORS errors

**Solutions:**
1. Verify `VITE_API_URL` is set correctly in Cloudflare Pages
2. Ensure variable starts with `VITE_` prefix
3. Redeploy after adding/changing environment variables
4. Check backend CORS configuration allows `app.audacious.money`

**Problem:** Stripe doesn't load

**Solutions:**
1. Verify `VITE_STRIPE_PUBLIC_KEY` is set
2. Ensure using `pk_live_*` in production (not `pk_test_*`)
3. Check CSP allows `https://js.stripe.com`
4. Verify in browser console: `window.ENV.VITE_STRIPE_PUBLIC_KEY`

### Custom Domain Issues

**Problem:** Domain shows "Not found" or doesn't load

**Solutions:**
1. Wait 5-10 minutes for DNS propagation
2. Verify CNAME record points to `[project-name].pages.dev`
3. Check DNS with: `nslookup app.audacious.money`
4. Ensure domain is added in **Custom domains** settings
5. Clear browser cache and try incognito mode

**Problem:** SSL certificate error

**Solutions:**
1. Wait up to 24 hours for certificate issuance
2. Verify domain ownership in Cloudflare
3. Check certificate status in Pages settings
4. Try removing and re-adding custom domain

### CSP Violations

**Problem:** Console shows "Refused to load ... violates CSP"

**Solutions:**
1. Check exact URL being blocked in console
2. Update `public/_headers` to allow that domain
3. Redeploy to apply new headers
4. Verify headers with: `curl -I https://app.audacious.money`

**Problem:** Stripe blocked by CSP

**Solutions:**
1. Ensure CSP includes:
   - `script-src ... https://js.stripe.com`
   - `connect-src ... https://api.stripe.com`
   - `frame-src https://js.stripe.com`
2. Redeploy after updating `_headers`

### Routing Issues

**Problem:** Refresh on `/dashboard` shows 404

**Solutions:**
1. Verify `public/_redirects` file exists
2. Ensure `_redirects` contains: `/*    /index.html   200`
3. Check Cloudflare Pages **Redirects** settings
4. Test with: `curl https://app.audacious.money/dashboard`

### Performance Issues

**Problem:** Slow page load times

**Solutions:**
1. Run Lighthouse audit to identify bottlenecks
2. Verify assets are cached (check Cache-Control headers)
3. Enable Cloudflare **Auto Minify** for JS, CSS, HTML
4. Consider enabling **Brotli compression** in Cloudflare
5. Optimize images and use WebP format

---

## Rollback Procedures

### Rollback to Previous Deployment

If a deployment introduces critical bugs:

**Via Cloudflare Dashboard:**

1. Go to Cloudflare Pages project
2. Navigate to **Deployments** tab
3. Find previous successful deployment
4. Click **⋯** (three dots) next to deployment
5. Click **Rollback to this deployment**
6. Confirm rollback

**Via Git:**

1. Revert commit locally:
   ```bash
   git revert [commit-hash]
   git push origin main
   ```
2. Cloudflare automatically deploys reverted commit

### Emergency Shutdown

If critical security issue discovered:

**Pause deployments:**
1. Go to **Settings** → **Builds & deployments**
2. Click **Pause deployments**
3. Fix issue in code
4. Resume deployments after verification

**Temporary redirect:**
1. Update `public/_redirects`:
   ```
   /*    /maintenance.html   200
   ```
2. Create maintenance page
3. Deploy to show maintenance mode

### Deployment Verification Before Going Live

Before directing traffic to new deployment:

1. **Test preview URL** thoroughly
2. **Run full test suite** (automated + manual)
3. **Load test** with realistic traffic
4. **Security scan** with OWASP ZAP or similar
5. **Lighthouse audit** for performance
6. **Cross-browser testing** on all supported browsers
7. **Get approval** from stakeholders
8. **Deploy during low-traffic window**
9. **Monitor logs** for errors
10. **Have rollback plan ready**

---

## Additional Resources

### Cloudflare Pages Documentation

- **Overview**: https://developers.cloudflare.com/pages/
- **Build configuration**: https://developers.cloudflare.com/pages/platform/build-configuration/
- **Redirects**: https://developers.cloudflare.com/pages/platform/redirects/
- **Headers**: https://developers.cloudflare.com/pages/platform/headers/
- **Custom domains**: https://developers.cloudflare.com/pages/platform/custom-domains/

### Security Resources

- **Content Security Policy (MDN)**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- **OWASP Security Headers**: https://owasp.org/www-project-secure-headers/
- **Security Headers Checker**: https://securityheaders.com/
- **Mozilla Observatory**: https://observatory.mozilla.org/

### Vite Documentation

- **Production Build**: https://vitejs.dev/guide/build.html
- **Environment Variables**: https://vitejs.dev/guide/env-and-mode.html
- **Deployment**: https://vitejs.dev/guide/static-deploy.html

### Support

- **Cloudflare Community**: https://community.cloudflare.com/
- **Cloudflare Support**: https://support.cloudflare.com/
- **Project Issues**: [Your GitHub repository]/issues

---

## Deployment Checklist Summary

Print this checklist for each deployment:

- [ ] Code tested locally with production build
- [ ] All environment variables configured correctly
- [ ] Security headers verified in `_headers` file
- [ ] `_redirects` file configured for SPA routing
- [ ] Build succeeds in Cloudflare Pages
- [ ] Preview deployment tested thoroughly
- [ ] Custom domain configured and SSL active
- [ ] Security headers verified with curl
- [ ] All API endpoints respond correctly
- [ ] Stripe integration working
- [ ] WebSocket connection established
- [ ] No console errors or warnings
- [ ] Lighthouse score > 90
- [ ] Cross-browser testing passed
- [ ] Rollback plan documented
- [ ] Team notified of deployment

---

**Deployment Status:** Ready for production
**Last Deployment:** [To be filled after first deployment]
**Deployed By:** [Your name]
**Next Review:** [Date]

---

**End of Cloudflare Pages Deployment Guide**
