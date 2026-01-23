# Caching Issue Analysis

**Date:** 2026-01-23
**Issue:** Hard refresh (Ctrl+Shift+R) not loading new code changes on app.audacious.money

---

## Root Cause Identified

Cloudflare Pages is serving the application **without proper cache control headers**, causing browsers to aggressively cache JavaScript and CSS files. Without a `_headers` file, Cloudflare uses default caching behavior which can be very aggressive.

### Why It Worked Yesterday

Yesterday's workflow (IndexedDB delete + hard refresh) likely worked for one or more of these reasons:

1. **Browser cache hadn't been established yet** - First few deployments before aggressive caching kicked in
2. **Natural cache expiration** - Browser's cache happened to expire between tests
3. **Different browser state** - Possibly used private/incognito window without realizing it
4. **Smaller changes** - Vite's build process might have generated different hash filenames, bypassing cache

### Why It's Failing Today

1. **Browser has cached the JavaScript bundles** with aggressive TTL (time-to-live)
2. **Hard refresh (Ctrl+Shift+R) only clears page cache**, not always asset cache depending on browser
3. **Cloudflare's edge cache** may also be caching files for extended periods
4. **No cache-busting headers** to force revalidation

---

## How Browser Caching Works

### What IndexedDB Delete Clears
- ✅ User data (accounts, transactions, wizard progress)
- ❌ Cached JavaScript code
- ❌ Cached CSS files
- ❌ Cached HTML

### What Hard Refresh (Ctrl+Shift+R) Clears
- ✅ HTML page cache
- ⚠️ **Sometimes** clears asset cache (inconsistent across browsers)
- ❌ Service worker cache (if present)
- ❌ Cloudflare edge cache

### What Incognito Window Does
- ✅ Starts with completely empty cache
- ✅ Forces fetch of all resources
- ✅ Bypasses all browser caching
- ✅ Reliable for testing deployments

---

## Current Deployment Pipeline

```
Code Change → Git Commit → Git Push
                             ↓
                    GitHub Actions Triggered
                             ↓
                    npm run build (creates dist/)
                             ↓
                    Cloudflare Pages Deploy
                             ↓
          Files uploaded to Cloudflare edge network
                             ↓
                ❌ NO _headers FILE ❌
                             ↓
            Cloudflare uses default caching
                             ↓
          Browser caches assets aggressively
```

---

## Solution Options

### Option 1: Create _headers File (RECOMMENDED)

Create a `public/_headers` file that gets copied to `dist/_headers` during build:

```
# Cloudflare Pages _headers file
# Disable caching for index.html to ensure fresh HTML
/index.html
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

# Allow short-term caching for JS/CSS with revalidation
/assets/*
  Cache-Control: public, max-age=3600, must-revalidate

# Allow longer caching for images and fonts (they're content-addressed)
/images/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
```

**Benefits:**
- Hard refresh will work reliably
- Users get fast subsequent page loads
- Proper cache control for different asset types
- Follows web best practices

**Implementation:**
1. Create `public/` directory in project root
2. Add `public/_headers` file with above content
3. Update Vite config to copy public files to dist
4. Commit and deploy

### Option 2: Update Cloudflare Pages Settings

Configure cache headers in Cloudflare dashboard:
- Go to Pages project settings
- Add custom headers
- Set cache control policies

**Downside:** Configuration not in source control

### Option 3: Continue Using Incognito Window (CURRENT WORKAROUND)

**Pros:**
- Works immediately without code changes
- Guaranteed fresh cache every time

**Cons:**
- Extra steps for every test
- Have to log in again each time
- Not a permanent solution

---

## Recommended Immediate Action

### Step 1: Create public directory structure
```bash
mkdir public
```

### Step 2: Create _headers file
```bash
cat > public/_headers << 'EOF'
# Cache control for Graceful Books
# Updated: 2026-01-23

# HTML - Never cache (always check for updates)
/index.html
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

# JavaScript and CSS - Short cache with revalidation
/assets/*.js
  Cache-Control: public, max-age=3600, must-revalidate

/assets/*.css
  Cache-Control: public, max-age=3600, must-revalidate

# Fonts and images - Long cache (content-addressed by Vite)
/assets/*.woff
  Cache-Control: public, max-age=31536000, immutable

/assets/*.woff2
  Cache-Control: public, max-age=31536000, immutable

/assets/*.svg
  Cache-Control: public, max-age=31536000, immutable

/assets/*.png
  Cache-Control: public, max-age=31536000, immutable

/assets/*.jpg
  Cache-Control: public, max-age=31536000, immutable
EOF
```

### Step 3: Update vite.config.ts

Vite automatically copies the `public/` directory to `dist/` during build, so no changes needed if we follow Vite conventions.

### Step 4: Test
1. Commit and push changes
2. Wait for deployment
3. Test with hard refresh (should now work)
4. Verify in DevTools Network tab that headers are correct

---

## Understanding Cache-Control Directives

- **no-cache**: Must revalidate with server before using cached version
- **no-store**: Never cache this resource
- **must-revalidate**: Once expired, must check with server
- **max-age=3600**: Cache for 1 hour (3600 seconds)
- **max-age=31536000**: Cache for 1 year
- **immutable**: File will never change (safe to cache forever)
- **public**: Can be cached by browsers and CDNs

---

## Why This Is the Right Solution

### Current Problem
- No control over caching behavior
- Inconsistent experience between deployments
- Requires workarounds (incognito) for testing

### After Fix
- ✅ Hard refresh will work as expected
- ✅ Fast loading for users (proper caching)
- ✅ Always fetch latest HTML (no stale pages)
- ✅ Assets cached appropriately by type
- ✅ Follows web standards and best practices

---

## Additional Notes

### Vite's Content Addressing
Vite automatically adds content hashes to asset filenames:
- Example: `app.abc123def.js`
- When code changes, hash changes
- New filename = automatic cache bust
- This is why **long cache times are safe** for /assets/*

### Why We Need Headers Anyway
Even though Vite uses content hashing, we need headers because:
1. **index.html doesn't have a hash** - needs fresh fetch every time
2. **Cloudflare needs explicit instructions** - default caching too aggressive
3. **Browser behavior varies** - explicit headers ensure consistency

---

## Conclusion

The caching issue is caused by **missing cache control headers**. Yesterday worked by luck/timing. The permanent fix is to add a `_headers` file to the project. This is a standard practice for Cloudflare Pages applications and should have been included from the start.

**Estimated time to implement:** 5 minutes
**Risk level:** Low (just adding headers, not changing code)
**Testing:** Deploy and verify with hard refresh

---

*This analysis explains why "we were doing just fine yesterday" - it wasn't that the workflow changed, it's that browser caching became more aggressive over time.*
