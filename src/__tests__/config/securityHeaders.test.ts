import { describe, it, expect } from 'vitest';
import {
  CSP_CONFIG,
  CSP_STRING,
  CSP_META_TAG_CONTENT,
  SECURITY_HEADERS,
  generateCSPString,
  getSecurityHeaders,
  getCSPMetaTagContent,
  CSP_REPORT_CONFIG,
  CSP_STRING_WITH_REPORTING,
  generateReportToHeader,
  generateCSPStringWithReporting,
  getSecurityHeadersWithReporting,
} from '../../config/securityHeaders';

describe('Security Headers Configuration', () => {
  describe('CSP_CONFIG', () => {
    it('should have all required directives', () => {
      const requiredDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'font-src',
        'connect-src',
        'frame-ancestors',
        'base-uri',
        'form-action',
        'object-src',
      ];

      requiredDirectives.forEach((directive) => {
        expect(CSP_CONFIG).toHaveProperty(directive);
        expect(Array.isArray(CSP_CONFIG[directive as keyof typeof CSP_CONFIG])).toBe(true);
      });
    });

    it('should restrict default-src to self', () => {
      expect(CSP_CONFIG['default-src']).toContain("'self'");
    });

    it('should restrict script-src to self only', () => {
      expect(CSP_CONFIG['script-src']).toEqual(["'self'"]);
    });

    it('should allow unsafe-inline for style-src (needed for CSS-in-JS)', () => {
      expect(CSP_CONFIG['style-src']).toContain("'self'");
      expect(CSP_CONFIG['style-src']).toContain("'unsafe-inline'");
    });

    it('should allow data URIs and HTTPS for images', () => {
      expect(CSP_CONFIG['img-src']).toContain("'self'");
      expect(CSP_CONFIG['img-src']).toContain('data:');
      expect(CSP_CONFIG['img-src']).toContain('https:');
    });

    it('should prevent framing entirely with frame-ancestors none', () => {
      expect(CSP_CONFIG['frame-ancestors']).toEqual(["'none'"]);
    });

    it('should disable object-src to prevent plugin abuse', () => {
      expect(CSP_CONFIG['object-src']).toEqual(["'none'"]);
    });
  });

  describe('generateCSPString', () => {
    it('should generate a valid CSP string from config', () => {
      const cspString = generateCSPString(CSP_CONFIG);

      expect(cspString).toContain("default-src 'self'");
      expect(cspString).toContain("script-src 'self'");
      expect(cspString).toContain("style-src 'self' 'unsafe-inline'");
      expect(cspString).toContain("img-src 'self' data: https:");
      expect(cspString).toContain("frame-ancestors 'none'");
      expect(cspString).toContain("object-src 'none'");
    });

    it('should separate directives with semicolons', () => {
      const cspString = generateCSPString(CSP_CONFIG);
      const directives = cspString.split('; ');

      expect(directives.length).toBeGreaterThan(1);
    });

    it('should handle custom config objects', () => {
      const customConfig = {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://trusted.com'],
        'style-src': ["'self'"],
        'img-src': ["'self'"],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
      };

      const cspString = generateCSPString(customConfig);

      expect(cspString).toContain("script-src 'self' https://trusted.com");
    });
  });

  describe('CSP_STRING', () => {
    it('should be pre-generated from CSP_CONFIG', () => {
      expect(CSP_STRING).toBe(generateCSPString(CSP_CONFIG));
    });

    it('should not be empty', () => {
      expect(CSP_STRING.length).toBeGreaterThan(0);
    });
  });

  describe('SECURITY_HEADERS', () => {
    it('should have the CSP config object', () => {
      expect(SECURITY_HEADERS.csp).toBe(CSP_CONFIG);
    });

    it('should have X-Frame-Options set to DENY', () => {
      expect(SECURITY_HEADERS.xFrameOptions).toBe('DENY');
    });

    it('should have X-Content-Type-Options set to nosniff', () => {
      expect(SECURITY_HEADERS.xContentTypeOptions).toBe('nosniff');
    });

    it('should have Referrer-Policy set to no-referrer', () => {
      expect(SECURITY_HEADERS.referrerPolicy).toBe('no-referrer');
    });

    it('should have Permissions-Policy restricting sensitive features', () => {
      expect(SECURITY_HEADERS.permissionsPolicy).toContain('geolocation=()');
      expect(SECURITY_HEADERS.permissionsPolicy).toContain('microphone=()');
      expect(SECURITY_HEADERS.permissionsPolicy).toContain('camera=()');
    });

    it('should have HSTS with appropriate max-age', () => {
      expect(SECURITY_HEADERS.strictTransportSecurity).toContain('max-age=31536000');
      expect(SECURITY_HEADERS.strictTransportSecurity).toContain('includeSubDomains');
    });
  });

  describe('getSecurityHeaders', () => {
    it('should return all security headers as key-value pairs', () => {
      const headers = getSecurityHeaders();

      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
      expect(headers).toHaveProperty('Strict-Transport-Security');
    });

    it('should have correct header values', () => {
      const headers = getSecurityHeaders();

      expect(headers['Content-Security-Policy']).toBe(CSP_STRING);
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBe('no-referrer');
    });

    it('should return a new object each time', () => {
      const headers1 = getSecurityHeaders();
      const headers2 = getSecurityHeaders();

      expect(headers1).not.toBe(headers2);
      expect(headers1).toEqual(headers2);
    });
  });

  describe('getCSPMetaTagContent', () => {
    it('should not include frame-ancestors (not supported in meta tags)', () => {
      const metaContent = getCSPMetaTagContent();

      expect(metaContent).not.toContain('frame-ancestors');
    });

    it('should include all other directives', () => {
      const metaContent = getCSPMetaTagContent();

      expect(metaContent).toContain("default-src 'self'");
      expect(metaContent).toContain("script-src 'self'");
      expect(metaContent).toContain("style-src 'self' 'unsafe-inline'");
      expect(metaContent).toContain("object-src 'none'");
    });
  });

  describe('CSP_META_TAG_CONTENT', () => {
    it('should be pre-generated without frame-ancestors', () => {
      expect(CSP_META_TAG_CONTENT).not.toContain('frame-ancestors');
      expect(CSP_META_TAG_CONTENT).toBe(getCSPMetaTagContent());
    });
  });

  describe('Security Best Practices', () => {
    it('should not allow unsafe-eval in script-src', () => {
      expect(CSP_CONFIG['script-src']).not.toContain("'unsafe-eval'");
    });

    it('should not allow wildcard (*) in any directive', () => {
      Object.values(CSP_CONFIG).forEach((sources) => {
        expect(sources).not.toContain('*');
      });
    });

    it('should restrict base-uri to prevent base tag injection', () => {
      expect(CSP_CONFIG['base-uri']).toContain("'self'");
      expect(CSP_CONFIG['base-uri'].length).toBe(1);
    });

    it('should restrict form-action to prevent form hijacking', () => {
      expect(CSP_CONFIG['form-action']).toContain("'self'");
    });
  });

  describe('CSP Reporting Configuration', () => {
    describe('CSP_REPORT_CONFIG', () => {
      it('should have all required properties', () => {
        expect(CSP_REPORT_CONFIG).toHaveProperty('reportOnly');
        expect(CSP_REPORT_CONFIG).toHaveProperty('reportUri');
        expect(CSP_REPORT_CONFIG).toHaveProperty('reportTo');
        expect(CSP_REPORT_CONFIG).toHaveProperty('maxAge');
      });

      it('should have reportOnly set to false by default for production security', () => {
        expect(CSP_REPORT_CONFIG.reportOnly).toBe(false);
      });

      it('should have a valid report URI', () => {
        expect(CSP_REPORT_CONFIG.reportUri).toBe('/api/csp-report');
      });

      it('should have a valid report-to group name', () => {
        expect(CSP_REPORT_CONFIG.reportTo).toBe('csp-endpoint');
      });

      it('should have a reasonable max-age value', () => {
        // Should be at least a week (604800 seconds)
        expect(CSP_REPORT_CONFIG.maxAge).toBeGreaterThanOrEqual(604800);
      });
    });

    describe('generateReportToHeader', () => {
      it('should generate valid JSON for Report-To header', () => {
        const header = generateReportToHeader(CSP_REPORT_CONFIG);
        const parsed = JSON.parse(header);

        expect(parsed.group).toBe(CSP_REPORT_CONFIG.reportTo);
        expect(parsed.max_age).toBe(CSP_REPORT_CONFIG.maxAge);
        expect(parsed.endpoints).toHaveLength(1);
        expect(parsed.endpoints[0].url).toBe(CSP_REPORT_CONFIG.reportUri);
      });

      it('should handle custom config', () => {
        const customConfig = {
          reportOnly: true,
          reportUri: '/custom/endpoint',
          reportTo: 'custom-group',
          maxAge: 3600,
        };

        const header = generateReportToHeader(customConfig);
        const parsed = JSON.parse(header);

        expect(parsed.group).toBe('custom-group');
        expect(parsed.max_age).toBe(3600);
        expect(parsed.endpoints[0].url).toBe('/custom/endpoint');
      });
    });

    describe('generateCSPStringWithReporting', () => {
      it('should include report-uri directive', () => {
        const csp = generateCSPStringWithReporting(CSP_CONFIG, CSP_REPORT_CONFIG);
        expect(csp).toContain('report-uri /api/csp-report');
      });

      it('should include report-to directive', () => {
        const csp = generateCSPStringWithReporting(CSP_CONFIG, CSP_REPORT_CONFIG);
        expect(csp).toContain('report-to csp-endpoint');
      });

      it('should include all original CSP directives', () => {
        const csp = generateCSPStringWithReporting(CSP_CONFIG, CSP_REPORT_CONFIG);
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
      });

      it('should append reporting directives after original directives', () => {
        const csp = generateCSPStringWithReporting(CSP_CONFIG, CSP_REPORT_CONFIG);
        const parts = csp.split('; ');

        // Reporting directives should be at the end
        const lastParts = parts.slice(-2);
        expect(lastParts).toContain('report-uri /api/csp-report');
        expect(lastParts).toContain('report-to csp-endpoint');
      });
    });

    describe('CSP_STRING_WITH_REPORTING', () => {
      it('should be pre-generated from config', () => {
        expect(CSP_STRING_WITH_REPORTING).toBe(
          generateCSPStringWithReporting(CSP_CONFIG, CSP_REPORT_CONFIG)
        );
      });

      it('should not be empty', () => {
        expect(CSP_STRING_WITH_REPORTING.length).toBeGreaterThan(0);
      });

      it('should include both original CSP and reporting', () => {
        expect(CSP_STRING_WITH_REPORTING).toContain("default-src 'self'");
        expect(CSP_STRING_WITH_REPORTING).toContain('report-uri');
        expect(CSP_STRING_WITH_REPORTING).toContain('report-to');
      });
    });

    describe('getSecurityHeadersWithReporting', () => {
      it('should include Report-To header', () => {
        const headers = getSecurityHeadersWithReporting();
        expect(headers).toHaveProperty('Report-To');
      });

      it('should have valid Report-To JSON', () => {
        const headers = getSecurityHeadersWithReporting();
        const reportTo = headers['Report-To'];
        expect(reportTo).toBeDefined();
        const parsed = JSON.parse(reportTo!);

        expect(parsed.group).toBe('csp-endpoint');
        expect(parsed.endpoints).toHaveLength(1);
      });

      it('should include CSP with reporting directives', () => {
        const headers = getSecurityHeadersWithReporting();
        expect(headers['Content-Security-Policy']).toContain('report-uri');
        expect(headers['Content-Security-Policy']).toContain('report-to');
      });

      it('should include all standard security headers', () => {
        const headers = getSecurityHeadersWithReporting();

        expect(headers).toHaveProperty('X-Frame-Options');
        expect(headers).toHaveProperty('X-Content-Type-Options');
        expect(headers).toHaveProperty('Referrer-Policy');
        expect(headers).toHaveProperty('Permissions-Policy');
        expect(headers).toHaveProperty('Strict-Transport-Security');
      });

      it('should return headers without reporting when disabled', () => {
        const headers = getSecurityHeadersWithReporting(false);

        expect(headers).not.toHaveProperty('Report-To');
        expect(headers['Content-Security-Policy']).not.toContain('report-uri');
      });

      it('should return a new object each time', () => {
        const headers1 = getSecurityHeadersWithReporting();
        const headers2 = getSecurityHeadersWithReporting();

        expect(headers1).not.toBe(headers2);
        expect(headers1).toEqual(headers2);
      });
    });
  });
});
