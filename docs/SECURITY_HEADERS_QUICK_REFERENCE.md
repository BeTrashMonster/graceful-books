# Security Headers Quick Reference

**Last Updated:** 2026-02-23
**Configuration File:** `public/_headers`
**Status:** Production-ready

---

## Quick Test

```bash
# Test staging
bash scripts/test-security-headers.sh https://staging.gracefulbooks.com

# Test production
bash scripts/test-security-headers.sh https://gracefulbooks.com

# Test with curl
curl -I https://gracefulbooks.com
```

---

## Configured Headers

| Header | Value | Purpose |
|--------|-------|---------|
| **Content-Security-Policy** | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ...` | Prevents XSS attacks |
| **X-Frame-Options** | `DENY` | Prevents clickjacking |
| **X-Content-Type-Options** | `nosniff` | Prevents MIME sniffing |
| **X-XSS-Protection** | `1; mode=block` | Legacy XSS protection |
| **Strict-Transport-Security** | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Protects privacy |
| **Permissions-Policy** | `geolocation=(), microphone=(), camera=()` | Restricts hardware |

---

## CSP Directives Explained

```
Content-Security-Policy:
  default-src 'self'              # Only load resources from same origin
  script-src 'self'               # Only same-origin scripts (no inline, no eval)
  style-src 'self' 'unsafe-inline' # Same-origin + inline styles (for CSS Modules)
  img-src 'self' data: https:     # Same-origin, data URIs, HTTPS images
  font-src 'self' data:           # Same-origin and data URI fonts
  connect-src 'self'              # API calls to same origin only
  frame-ancestors 'none'          # Cannot be embedded in frames
  base-uri 'self'                 # Restrict <base> tag
  form-action 'self'              # Forms submit to same origin only
  object-src 'none'               # Disable plugins (Flash, etc.)
```

---

## Security Ratings

**Target Scores:**
- SecurityHeaders.com: **A+**
- Mozilla Observatory: **A+**
- CSP Evaluator: **No critical issues**

**How to Check:**
1. Visit https://securityheaders.com/
2. Enter your URL
3. Verify A+ rating

---

## Common Issues & Solutions

### Issue: Application won't load after deployment

**Check:**
```bash
# Look for CSP violations in browser console
# Open DevTools > Console > Filter by "CSP"
```

**Solution:**
- Verify all scripts are bundled (no external CDNs)
- Check that Vite build completed successfully
- Ensure no inline scripts in HTML

### Issue: Styles not applying

**Check:**
- `style-src 'self' 'unsafe-inline'` is present

**Solution:**
- Verify CSS Modules are being used correctly
- Ensure no external stylesheets

### Issue: Images not loading

**Check:**
- `img-src 'self' data: https:` is present

**Solution:**
- Verify images are in `/assets` or use data URIs
- Check for mixed content (HTTP images on HTTPS site)

### Issue: API calls failing

**Check:**
- `connect-src 'self'` is present

**Solution:**
- Verify API calls are to same origin
- If using external APIs, update CSP (carefully!)

---

## Updating Headers

### When to Update

1. **New third-party integration** (requires CSP update)
2. **New external API** (requires connect-src update)
3. **New security vulnerability** (follow security advisories)
4. **Browser deprecations** (monitor MDN updates)

### How to Update

1. **Edit** `public/_headers`
2. **Test locally** with Netlify CLI or Cloudflare Wrangler
3. **Deploy to staging**
4. **Run security scans**
5. **Test functionality**
6. **Deploy to production**

### Adding External Resources (Use Caution!)

If you must add external resources:

```
# Example: Adding Google Fonts
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  ...
```

**Important:**
- Minimize external dependencies (zero-knowledge architecture!)
- Use Subresource Integrity (SRI) when possible
- Document why external resource is needed

---

## Emergency Rollback

If headers break production:

```bash
# Option 1: Revert via Git
git revert <commit-hash>
git push origin main

# Option 2: Platform rollback
netlify rollback  # Netlify
# or platform-specific command

# Option 3: Quick fix - comment out problematic header
# Edit public/_headers, redeploy
```

---

## Monitoring

### Weekly Checks
- [ ] Run SecurityHeaders.com scan
- [ ] Check for CSP violations (if reporting enabled)
- [ ] Review error logs for header-related issues

### Monthly Checks
- [ ] Run full security scan (SecurityHeaders + Observatory)
- [ ] Review CSP policy (can it be stricter?)
- [ ] Update documentation if changes made

### Quarterly Checks
- [ ] Review security advisories (OWASP, MDN)
- [ ] Check for new header recommendations
- [ ] Audit third-party dependencies

---

## Platform-Specific Commands

### Netlify
```bash
# Deploy
netlify deploy --prod --dir=dist

# Test locally
netlify dev

# Rollback
netlify rollback
```

### Cloudflare Pages
```bash
# Deploy
wrangler pages publish dist

# Test locally
wrangler pages dev dist

# Rollback via dashboard
# Visit Cloudflare dashboard > Pages > Deployments
```

### Vercel
```bash
# Deploy
vercel --prod

# Note: Requires vercel.json (not _headers)
# See docs/SECURITY_HEADERS_CONFIGURATION.md for conversion
```

---

## Testing Checklist

**Before Deploying to Production:**

- [ ] SecurityHeaders.com scan shows A+
- [ ] Mozilla Observatory scan shows A+
- [ ] Application loads correctly
- [ ] All features work (spot check)
- [ ] No console errors
- [ ] Tested in Chrome, Firefox, Safari
- [ ] Mobile testing completed (iOS/Android)

---

## Files & Documentation

**Configuration:**
- `public/_headers` - Main configuration file

**Documentation:**
- `docs/SECURITY_HEADERS_CONFIGURATION.md` - Comprehensive guide (22KB)
- `docs/SECURITY_HEADERS_DEPLOYMENT_CHECKLIST.md` - Deployment procedures
- `docs/SECURITY_HEADERS_QUICK_REFERENCE.md` - This file
- `docs/S5-1_COMPLETION_REPORT.md` - Implementation report

**Scripts:**
- `scripts/test-security-headers.sh` - Automated header verification

**Development:**
- `vite.config.ts` - Development headers (more permissive)
- `index.html` - Meta CSP fallback

---

## Contact & Support

**Questions?**
- Review `docs/SECURITY_HEADERS_CONFIGURATION.md` for detailed explanations
- Check troubleshooting section for common issues
- Review security roadmap: `Roadmaps/SECURITY_HARDENING_ROADMAP.md`

**Security Issues?**
- Run security scans immediately
- Check for CSP violations in console
- Review recent changes to `public/_headers`
- Test with `scripts/test-security-headers.sh`

---

## Remember

- **Security headers protect users** - Don't disable for convenience
- **Test before deploying** - Always verify in staging first
- **Document changes** - Update this guide when modifying headers
- **Monitor regularly** - Security is an ongoing process
- **Be cautious with CSP** - Relaxing CSP reduces security

---

**Need Help?**
See full documentation: `docs/SECURITY_HEADERS_CONFIGURATION.md`
