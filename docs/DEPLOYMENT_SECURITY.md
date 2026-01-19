# Deployment Security Guide

This guide provides comprehensive security configuration requirements for deploying Graceful Books to production environments. Following these guidelines helps protect user data and maintain the zero-knowledge architecture.

## Table of Contents

- [Required Security Headers](#required-security-headers)
- [HTTPS Enforcement](#https-enforcement)
- [CORS Policy](#cors-policy)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Deployment Checklist](#deployment-checklist)
- [Monitoring and Logging](#monitoring-and-logging)
- [Incident Response](#incident-response)
- [Verification Steps](#verification-steps)

---

## Required Security Headers

All production deployments must include the following security headers. These are defined in `src/config/securityHeaders.ts` and should be enforced at the server/CDN level.

### Content Security Policy (CSP)

The CSP configuration restricts resource loading to prevent XSS and injection attacks.

**Full CSP Header:**
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

**Directive Breakdown:**

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Fallback for unspecified resource types; restricts to same origin |
| `script-src` | `'self'` | Prevents XSS by only allowing scripts from same origin |
| `style-src` | `'self' 'unsafe-inline'` | Allows same-origin styles and inline styles (required for CSS-in-JS) |
| `img-src` | `'self' data: https:` | Allows same-origin, data URIs, and HTTPS images |
| `font-src` | `'self'` | Restricts fonts to same origin |
| `connect-src` | `'self'` | Restricts API calls (fetch, XHR, WebSocket) to same origin |
| `frame-ancestors` | `'none'` | Prevents clickjacking by blocking all framing |
| `base-uri` | `'self'` | Prevents base tag injection attacks |
| `form-action` | `'self'` | Prevents form hijacking attacks |
| `object-src` | `'none'` | Blocks plugins (Flash, Java) - not needed in modern apps |

**Important Notes:**
- The `frame-ancestors` directive cannot be enforced via HTML meta tags; it requires HTTP headers
- If using a CDN or external analytics, you may need to add those domains to `script-src` and `connect-src`
- The `'unsafe-inline'` for styles is required for React styling solutions

### Additional Security Headers

These headers provide additional protection layers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Legacy clickjacking protection (backup for browsers without CSP support) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing attacks |
| `Referrer-Policy` | `no-referrer` | Protects user privacy by not sending referrer information |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Disables sensitive browser features not needed by the application |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS for 1 year including subdomains |

### Server Configuration Examples

**Nginx:**
```nginx
# Security headers configuration
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**Apache (.htaccess):**
```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
Header always set X-Frame-Options "DENY"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "no-referrer"
Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

**Vercel (vercel.json):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "no-referrer"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

**Cloudflare Workers:**
```javascript
// Add headers to response
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Apply to response
Object.entries(securityHeaders).forEach(([key, value]) => {
  response.headers.set(key, value);
});
```

---

## HTTPS Enforcement

HTTPS is mandatory for all production deployments. The zero-knowledge encryption architecture requires secure transport to protect the encrypted payloads in transit.

### Requirements

1. **Valid TLS Certificate**
   - Use certificates from trusted Certificate Authorities (Let's Encrypt is free and recommended)
   - Ensure certificate covers all subdomains if using `includeSubDomains` in HSTS
   - Set up automatic renewal (certificates expire every 90 days with Let's Encrypt)

2. **TLS Configuration**
   - Minimum TLS version: 1.2 (TLS 1.3 preferred)
   - Strong cipher suites only
   - Forward secrecy enabled

3. **HTTP to HTTPS Redirect**
   - All HTTP requests must redirect to HTTPS (301 permanent redirect)
   - Redirect before any other processing

### Nginx TLS Configuration

```nginx
server {
    listen 80;
    server_name gracefulbooks.com www.gracefulbooks.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gracefulbooks.com www.gracefulbooks.com;

    # TLS certificate
    ssl_certificate /etc/letsencrypt/live/gracefulbooks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gracefulbooks.com/privkey.pem;

    # TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
}
```

### Verification

Test your TLS configuration:
- SSL Labs: https://www.ssllabs.com/ssltest/
- Target grade: A or A+

---

## CORS Policy

Cross-Origin Resource Sharing (CORS) must be configured to allow only trusted origins.

### Production Configuration

```javascript
// Allowed origins - be specific, never use wildcard (*) in production
const ALLOWED_ORIGINS = [
  'https://gracefulbooks.com',
  'https://www.gracefulbooks.com',
  'https://app.gracefulbooks.com'
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': request.headers.get('Origin'), // Validate against ALLOWED_ORIGINS first
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours preflight cache
  'Access-Control-Allow-Credentials': 'true'
};

// Origin validation
function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
```

### Nginx CORS Configuration

```nginx
# CORS configuration
set $cors_origin "";
if ($http_origin ~* "^https://(gracefulbooks\.com|www\.gracefulbooks\.com|app\.gracefulbooks\.com)$") {
    set $cors_origin $http_origin;
}

add_header 'Access-Control-Allow-Origin' $cors_origin always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
add_header 'Access-Control-Allow-Credentials' 'true' always;

# Handle preflight requests
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Max-Age' 86400;
    add_header 'Content-Type' 'text/plain charset=UTF-8';
    add_header 'Content-Length' 0;
    return 204;
}
```

### Important CORS Guidelines

1. **Never use wildcard (`*`) in production** - Always specify exact origins
2. **Validate Origin header** - Check against allowlist before responding
3. **Credentials require specific origin** - Cannot use `*` with `credentials: true`
4. **Preflight caching** - Use `Access-Control-Max-Age` to reduce OPTIONS requests

---

## Environment-Specific Configuration

### Development

```bash
# .env.development
NODE_ENV=development
VITE_APP_ENV=development
VITE_DB_NAME=graceful-books-dev
VITE_ENABLE_DEBUG_TOOLS=true
VITE_ENABLE_CONSOLE_LOGS=true

# Security (relaxed for local development)
# CSP can be more permissive for hot reloading
# CORS allows localhost
```

**Development Notes:**
- Debug tools enabled for React DevTools
- Console logging enabled for debugging
- CSP may need `'unsafe-eval'` for hot module replacement
- CORS can allow `http://localhost:*`

### Staging

```bash
# .env.staging
NODE_ENV=staging
VITE_APP_ENV=staging
VITE_DB_NAME=graceful-books-staging
VITE_ENABLE_DEBUG_TOOLS=true
VITE_ENABLE_CONSOLE_LOGS=true
VITE_ERROR_TRACKING_ENABLED=true

# Security (production-like but with debugging)
# Full CSP enforced
# CORS allows staging domains
# HSTS with shorter max-age (1 week)
```

**Staging Notes:**
- Production-like security configuration
- Debug tools available for testing
- Error tracking enabled
- Separate database from production
- HSTS can use shorter duration for testing

### Production

```bash
# .env.production
NODE_ENV=production
VITE_APP_ENV=production
VITE_DB_NAME=graceful-books
VITE_ENABLE_DEBUG_TOOLS=false
VITE_ENABLE_CONSOLE_LOGS=false
VITE_ERROR_TRACKING_ENABLED=true

# Security (maximum)
# Full CSP strictly enforced
# CORS only allows production domains
# Full HSTS (1 year + includeSubDomains)
# All security headers required
```

**Production Notes:**
- All debug features disabled
- Console logging disabled
- Error tracking for monitoring (not exposing details to users)
- Strictest security configuration
- All headers required with no exceptions

---

## Deployment Checklist

Complete this checklist before every production deployment.

### Pre-Deployment

- [ ] **HTTPS enabled** with valid TLS certificate
- [ ] **Certificate auto-renewal** configured and tested
- [ ] **TLS 1.2+** with strong cipher suites
- [ ] **HTTP to HTTPS** redirect configured
- [ ] **Security headers** configured (verify with SecurityHeaders.com)
  - [ ] Content-Security-Policy
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Referrer-Policy: no-referrer
  - [ ] Permissions-Policy
  - [ ] Strict-Transport-Security
- [ ] **CORS policy** restricts to known origins (no wildcards)
- [ ] **Environment variables** set correctly for production
- [ ] **Debug mode disabled** (VITE_ENABLE_DEBUG_TOOLS=false)
- [ ] **Console logging disabled** (VITE_ENABLE_CONSOLE_LOGS=false)
- [ ] **Error messages sanitized** (no stack traces to users)

### Security Testing

- [ ] **npm audit** shows no critical vulnerabilities
- [ ] **Secret scanning** passed (no secrets in code)
- [ ] **Static analysis** passed (ESLint security rules)
- [ ] **Dependencies up to date** (check npm outdated)
- [ ] **SSL Labs test** grade A or A+
- [ ] **SecurityHeaders.com test** grade A or better

### Infrastructure

- [ ] **Rate limiting enabled** to prevent abuse
- [ ] **DDoS protection** configured (Cloudflare or similar)
- [ ] **Firewall rules** restrict unnecessary ports
- [ ] **Backup strategy** in place and tested
- [ ] **Monitoring alerts** configured

### Application

- [ ] **All tests pass** (unit, integration, e2e)
- [ ] **Type checking passes** (npm run type-check)
- [ ] **Build succeeds** without errors
- [ ] **Staging tested** and verified
- [ ] **Rollback plan** documented and tested

### Post-Deployment

- [ ] **Health check** endpoints responding
- [ ] **Monitoring** shows normal metrics
- [ ] **Error rates** within acceptable thresholds
- [ ] **Performance** meets SLA targets
- [ ] **Security headers** verified in browser DevTools

---

## Monitoring and Logging

### What to Monitor

1. **Security Events**
   - Failed authentication attempts
   - Rate limit hits
   - CSP violations (use report-uri or report-to)
   - Unusual traffic patterns
   - Error rate spikes

2. **Performance Metrics**
   - Response times
   - Error rates
   - Availability/uptime
   - Sync latency

3. **Infrastructure**
   - TLS certificate expiration
   - Disk usage
   - Memory usage
   - CPU usage

### What to Log

**Do Log:**
- Request timestamps and methods
- Response status codes
- Error types (without sensitive details)
- Authentication events (success/failure)
- Rate limiting events
- Security header violations

**Do NOT Log:**
- Encryption keys or passwords
- Full request/response bodies
- User financial data
- Session tokens
- Personally identifiable information (PII)

### CSP Violation Reporting

Enable CSP violation reporting to detect attacks:

```
Content-Security-Policy: ...; report-uri /api/csp-report; report-to csp-endpoint
```

```javascript
// Endpoint to receive CSP violation reports
app.post('/api/csp-report', (req, res) => {
  const report = req.body['csp-report'];
  console.log('CSP Violation:', {
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    documentUri: report['document-uri'],
    timestamp: new Date().toISOString()
  });
  res.status(204).send();
});
```

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | >1% | >5% |
| Response time (p95) | >2s | >5s |
| Failed auth attempts | >10/min | >50/min |
| Rate limit hits | >100/min | >500/min |
| CSP violations | >10/hour | >100/hour |

---

## Incident Response

For security incidents, follow the comprehensive runbook at `docs/incident-response/runbooks/09-security-incident.md`.

### Quick Reference

**Immediate Actions (< 5 minutes):**
1. Alert security team via designated channel
2. Preserve evidence (logs, database state)
3. Assess scope of incident

**Containment Options:**
1. Disable affected feature (if isolated)
2. Rollback to last known secure version
3. Enable stricter rate limiting
4. Block suspicious IPs
5. Take service offline (last resort, requires approval)

**Communication:**
- Internal: Coordinate in private channel before public statement
- External: Follow legal notification requirements (72 hours for GDPR)
- Users: Notify promptly with clear instructions

### Emergency Contacts

Document these contacts and keep them accessible:
- Security team lead
- CTO/CEO (for service-down decisions)
- Legal counsel (for breach notifications)
- Infrastructure provider support

---

## Verification Steps

After deployment, verify security configuration:

### 1. Test Security Headers

```bash
# Check all headers
curl -I https://gracefulbooks.com

# Expected output includes:
# Content-Security-Policy: default-src 'self'; ...
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: no-referrer
# Permissions-Policy: geolocation=(), microphone=(), camera=()
# Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Online tools:
- https://securityheaders.com/ (target: Grade A)
- https://observatory.mozilla.org/

### 2. Test TLS Configuration

```bash
# Quick test
openssl s_client -connect gracefulbooks.com:443 -servername gracefulbooks.com

# Verify TLS version
openssl s_client -connect gracefulbooks.com:443 -tls1_2
openssl s_client -connect gracefulbooks.com:443 -tls1_3
```

Online tool:
- https://www.ssllabs.com/ssltest/ (target: Grade A+)

### 3. Test CORS

```bash
# Test preflight request
curl -X OPTIONS https://api.gracefulbooks.com/sync \
  -H "Origin: https://gracefulbooks.com" \
  -H "Access-Control-Request-Method: POST" \
  -I

# Verify response includes:
# Access-Control-Allow-Origin: https://gracefulbooks.com
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

### 4. Test CSP Enforcement

Open browser DevTools > Console while using the application:
- No CSP violation errors should appear
- Test by temporarily adding an inline script to verify CSP blocks it

### 5. Verify No Sensitive Data Exposure

```bash
# Check error responses don't leak details
curl -X POST https://api.gracefulbooks.com/invalid-endpoint

# Should return generic error, not stack trace
```

---

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)
- [HSTS Preload List](https://hstspreload.org/)

## See Also

- [SECURITY.md](../SECURITY.md) - Security policy and vulnerability reporting
- [docs/SECURITY_SCANNING.md](./SECURITY_SCANNING.md) - CI/CD security scanning
- [docs/incident-response/](./incident-response/) - Incident response runbooks
- [relay/docs/SECURITY_CHECKLIST.md](../relay/docs/SECURITY_CHECKLIST.md) - Self-hosted relay security
- [src/config/securityHeaders.ts](../src/config/securityHeaders.ts) - Security headers implementation

---

**Last Updated:** 2026-01-18
**Maintained by:** Security Team
