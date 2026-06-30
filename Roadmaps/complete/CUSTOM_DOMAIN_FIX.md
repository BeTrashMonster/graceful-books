# Custom Domain Configuration Fix

**Date:** 2026-01-23
**Issue:** app.audacious.money not receiving automatic updates from deployments
**Status:** graceful-books.pages.dev works perfectly, custom domain does not

---

## Root Cause

The Cloudflare Pages project "graceful-books" is deploying successfully, but the custom domain `app.audacious.money` is not properly configured to receive automatic updates. This is a **Cloudflare Pages custom domain configuration issue**, not a code issue.

---

## Immediate Workaround (Current)

**Use the direct Cloudflare Pages URL for testing:**
- URL: https://graceful-books.pages.dev
- This always reflects the latest deployment from main branch
- No caching issues, always up-to-date

---

## Production Fix Required

To make app.audacious.money work properly for public users, we need to configure the custom domain correctly in Cloudflare.

### Step 1: Verify Custom Domain Configuration

**In Cloudflare Pages Dashboard:**

1. Log into Cloudflare dashboard
2. Navigate to **Pages** → **graceful-books** project
3. Go to **Custom domains** tab
4. Check if `app.audacious.money` is listed

**Expected Configuration:**
```
Custom Domain: app.audacious.money
Status: Active
Points to: graceful-books.pages.dev (main branch)
Auto-deploy: Enabled
```

### Step 2: Check DNS Configuration

**In Cloudflare DNS Settings (for audacious.money domain):**

The DNS record should be:
```
Type: CNAME
Name: app
Target: graceful-books.pages.dev
Proxy status: Proxied (orange cloud)
TTL: Auto
```

**If it's an A record instead:**
- This could be pointing to a static IP that doesn't update
- Should be changed to CNAME pointing to graceful-books.pages.dev

### Step 3: Verify Branch Configuration

In Cloudflare Pages project settings:

**Production Branch Configuration:**
```
Production branch: main
Build command: npm run build
Build output directory: /dist
Root directory: /
```

**Ensure:**
- ✅ Production deployments trigger on push to main
- ✅ Custom domain points to production (not a specific deployment)

### Step 4: Check Cloudflare Cache Settings

**For app.audacious.money domain:**

1. Go to Cloudflare dashboard → **Caching** → **Configuration**
2. Check cache level: Should be "Standard" or "No Query String"
3. Browser Cache TTL: Should respect origin headers (our _headers file)

**Purge Cache:**
After fixing configuration, purge cache:
- Cloudflare dashboard → **Caching** → **Purge Cache**
- Select "Purge Everything" for app.audacious.money

### Step 5: Add Cache Purge to Deployment Workflow (Recommended)

Add a step to automatically purge Cloudflare cache after successful deployment.

**In `.github/workflows/deploy-pages.yml`:**

```yaml
- name: Purge Cloudflare Cache
  if: success()
  run: |
    curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
      -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}'
```

**Required Secrets:**
- `CLOUDFLARE_ZONE_ID` - Zone ID for audacious.money domain
- `CLOUDFLARE_API_TOKEN` - Already exists (used for Pages deployment)

---

## Most Likely Issues

### Issue 1: Custom Domain Points to Specific Deployment (Not Production Branch)

**Symptom:** Domain shows old version, never updates
**Fix:** In Pages dashboard, remove and re-add custom domain, ensure it points to "production" (main branch)

### Issue 2: DNS Record Type

**Symptom:** Domain loads but doesn't update, or shows wrong version
**Fix:** Change A record to CNAME record pointing to graceful-books.pages.dev

### Issue 3: Cloudflare Edge Cache Too Aggressive

**Symptom:** Changes deploy but take hours to appear on custom domain
**Fix:**
- Purge cache manually after deployments
- Add automatic cache purge to workflow (Step 5 above)
- Verify _headers file is being served (check Network tab in DevTools)

---

## Diagnostic Commands

### Check DNS Configuration
```bash
nslookup app.audacious.money
dig app.audacious.money CNAME
```

### Check HTTP Headers
```bash
curl -I https://app.audacious.money/
curl -I https://graceful-books.pages.dev/
```

Compare headers - they should be identical if properly configured.

### Check Latest Deployment
```bash
# In Cloudflare Pages dashboard, check:
# - Latest deployment timestamp
# - Which branch it deployed from
# - Whether custom domains are linked
```

---

## Recommended Solution Path

**For immediate production readiness:**

1. **Verify DNS:** Change to CNAME if it's an A record
2. **Verify Custom Domain Link:** Ensure app.audacious.money points to production (main branch)
3. **Purge Cache Manually:** One-time purge of everything for app.audacious.money
4. **Add Auto Cache Purge:** Add workflow step to purge after successful deploy
5. **Test:** Push a small change, verify it appears on both URLs

**Time to implement:** 15-20 minutes
**Testing time:** 5 minutes (deploy a test change)

---

## Why graceful-books.pages.dev Works But Custom Domain Doesn't

**graceful-books.pages.dev:**
- Direct Cloudflare Pages URL
- Automatically updates with every deployment
- No custom domain caching layers
- Always points to latest production deployment

**app.audacious.money:**
- Custom domain requiring proper DNS configuration
- Subject to Cloudflare's edge cache for that domain
- May be pointing to wrong deployment target
- Requires explicit cache purging if cache is aggressive

---

## Testing After Fix

After implementing the fix, test with this workflow:

1. Make a small visible change (e.g., change a button label)
2. Commit and push to main
3. Wait 2-5 minutes for deployment
4. Check graceful-books.pages.dev (should see change immediately)
5. Check app.audacious.money in incognito window (should see change)
6. If app.audacious.money doesn't update, purge cache manually

---

## Success Criteria

✅ Both URLs show identical content
✅ Changes pushed to main appear on both URLs within 5 minutes
✅ Hard refresh works on both URLs
✅ No need for incognito window workaround

---

## Next Steps

**Immediate (to get back to efficient workflow):**
1. Continue using graceful-books.pages.dev for development testing
2. Update DEVELOPMENT_WORKFLOW_SOP.md to use graceful-books.pages.dev

**Before public launch:**
1. Fix custom domain configuration (Steps 1-5 above)
2. Add automatic cache purge to deployment workflow
3. Test that app.audacious.money updates properly
4. Update workflow SOP back to app.audacious.money once confirmed working

---

*This ensures a reliable deployment workflow for production users.*
