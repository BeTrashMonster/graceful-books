import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CSPViolationReport,
  ReportingAPIReport,
  SanitizedViolation,
  cspReportRateLimiter,
  sanitizeViolationReport,
  convertReportingAPIFormat,
  isLegacyReport,
  isReportingAPIReport,
  handleCSPReport,
  registerViolationHandler,
  clearViolationHandlers,
  createViolationStatistics,
  CSP_REPORT_RATE_LIMITER_CONFIG,
} from '../../api/cspReportHandler';

describe('CSP Report Handler', () => {
  beforeEach(() => {
    cspReportRateLimiter.reset();
    clearViolationHandlers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSP_REPORT_RATE_LIMITER_CONFIG', () => {
    it('should have reasonable default values', () => {
      expect(CSP_REPORT_RATE_LIMITER_CONFIG.maxReports).toBe(100);
      expect(CSP_REPORT_RATE_LIMITER_CONFIG.windowMs).toBe(60000);
      expect(CSP_REPORT_RATE_LIMITER_CONFIG.logOnExceed).toBe(true);
    });
  });

  describe('cspReportRateLimiter', () => {
    it('should allow reports under the limit', () => {
      const sourceId = 'test-source-1';

      for (let i = 0; i < 50; i++) {
        expect(cspReportRateLimiter.shouldAllow(sourceId)).toBe(true);
      }
    });

    it('should block reports over the limit', () => {
      const sourceId = 'test-source-2';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Use up the limit
      for (let i = 0; i < CSP_REPORT_RATE_LIMITER_CONFIG.maxReports; i++) {
        cspReportRateLimiter.shouldAllow(sourceId);
      }

      // Next request should be blocked
      expect(cspReportRateLimiter.shouldAllow(sourceId)).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate Limit')
      );
    });

    it('should track different sources independently', () => {
      const source1 = 'source-a';
      const source2 = 'source-b';

      // Use up source1's limit
      for (let i = 0; i < CSP_REPORT_RATE_LIMITER_CONFIG.maxReports; i++) {
        cspReportRateLimiter.shouldAllow(source1);
      }

      // source2 should still be allowed
      expect(cspReportRateLimiter.shouldAllow(source2)).toBe(true);
      // source1 should be blocked
      expect(cspReportRateLimiter.shouldAllow(source1)).toBe(false);
    });

    it('should reset state correctly', () => {
      const sourceId = 'reset-test';

      // Use up the limit
      for (let i = 0; i < CSP_REPORT_RATE_LIMITER_CONFIG.maxReports; i++) {
        cspReportRateLimiter.shouldAllow(sourceId);
      }

      expect(cspReportRateLimiter.shouldAllow(sourceId)).toBe(false);

      // Reset and try again
      cspReportRateLimiter.reset();
      expect(cspReportRateLimiter.shouldAllow(sourceId)).toBe(true);
    });

    it('should return correct count for source', () => {
      const sourceId = 'count-test';

      expect(cspReportRateLimiter.getCount(sourceId)).toBe(0);

      cspReportRateLimiter.shouldAllow(sourceId);
      expect(cspReportRateLimiter.getCount(sourceId)).toBe(1);

      cspReportRateLimiter.shouldAllow(sourceId);
      expect(cspReportRateLimiter.getCount(sourceId)).toBe(2);
    });
  });

  describe('isLegacyReport', () => {
    it('should return true for valid legacy reports', () => {
      const legacyReport: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'https://evil.com/script.js',
          'status-code': 0,
        },
      };

      expect(isLegacyReport(legacyReport)).toBe(true);
    });

    it('should return false for non-legacy reports', () => {
      expect(isLegacyReport(null)).toBe(false);
      expect(isLegacyReport(undefined)).toBe(false);
      expect(isLegacyReport({})).toBe(false);
      expect(isLegacyReport({ type: 'csp-violation' })).toBe(false);
    });
  });

  describe('isReportingAPIReport', () => {
    it('should return true for valid Reporting API reports', () => {
      const reportingAPIReport: ReportingAPIReport = {
        type: 'csp-violation',
        url: 'https://example.com/page',
        user_agent: 'Mozilla/5.0',
        body: {
          documentURL: 'https://example.com/page',
          referrer: '',
          blockedURL: 'https://evil.com/script.js',
          effectiveDirective: 'script-src',
          originalPolicy: "default-src 'self'",
          disposition: 'enforce',
          statusCode: 0,
        },
      };

      expect(isReportingAPIReport(reportingAPIReport)).toBe(true);
    });

    it('should return false for non-Reporting API reports', () => {
      expect(isReportingAPIReport(null)).toBe(false);
      expect(isReportingAPIReport(undefined)).toBe(false);
      expect(isReportingAPIReport({})).toBe(false);
      expect(isReportingAPIReport({ 'csp-report': {} })).toBe(false);
    });
  });

  describe('sanitizeViolationReport', () => {
    it('should sanitize basic violation report', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://app.example.com/dashboard',
          'referrer': 'https://app.example.com/login',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'; script-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'https://malicious.com/evil.js',
          'status-code': 0,
        },
      };

      const sanitized = sanitizeViolationReport(report);

      expect(sanitized.violatedDirective).toBe('script-src');
      expect(sanitized.effectiveDirective).toBe('script-src');
      expect(sanitized.disposition).toBe('enforce');
      expect(sanitized.blockedDomain).toBe('malicious.com');
      expect(sanitized.blockedResourceType).toBe('script');
      expect(sanitized.hasScriptSample).toBe(false);
      expect(sanitized.timestamp).toBeDefined();
    });

    it('should handle inline violations', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://app.example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "script-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'inline',
          'status-code': 0,
          'script-sample': 'alert("xss")',
        },
      };

      const sanitized = sanitizeViolationReport(report);

      expect(sanitized.blockedDomain).toBe('inline');
      expect(sanitized.blockedResourceType).toBe('script');
      expect(sanitized.hasScriptSample).toBe(true);
    });

    it('should handle eval violations', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://app.example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "script-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'eval',
          'status-code': 0,
        },
      };

      const sanitized = sanitizeViolationReport(report);

      expect(sanitized.blockedDomain).toBe('eval');
      expect(sanitized.blockedResourceType).toBe('script');
    });

    it('should include source location when available', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://app.example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "script-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'https://evil.com/script.js',
          'status-code': 0,
          'source-file': 'https://app.example.com/bundle.js',
          'line-number': 42,
          'column-number': 10,
        },
      };

      const sanitized = sanitizeViolationReport(report);

      expect(sanitized.sourceLocation).toBeDefined();
      expect(sanitized.sourceLocation?.file).toBe('app.example.com');
      expect(sanitized.sourceLocation?.line).toBe(42);
      expect(sanitized.sourceLocation?.column).toBe(10);
    });

    it('should identify different resource types correctly', () => {
      const testCases = [
        { directive: 'style-src', expected: 'style' },
        { directive: 'img-src', expected: 'image' },
        { directive: 'font-src', expected: 'font' },
        { directive: 'connect-src', expected: 'connection' },
        { directive: 'frame-src', expected: 'frame' },
        { directive: 'object-src', expected: 'object' },
      ];

      for (const { directive, expected } of testCases) {
        const report: CSPViolationReport = {
          'csp-report': {
            'document-uri': 'https://app.example.com/page',
            'referrer': '',
            'violated-directive': directive,
            'effective-directive': directive,
            'original-policy': `${directive} 'self'`,
            'disposition': 'enforce',
            'blocked-uri': 'https://blocked.com/resource',
            'status-code': 0,
          },
        };

        const sanitized = sanitizeViolationReport(report);
        expect(sanitized.blockedResourceType).toBe(expected);
      }
    });
  });

  describe('convertReportingAPIFormat', () => {
    it('should convert Reporting API format to legacy format', () => {
      const reportingAPIReport: ReportingAPIReport = {
        type: 'csp-violation',
        url: 'https://example.com/page',
        user_agent: 'Mozilla/5.0',
        body: {
          documentURL: 'https://example.com/page',
          referrer: 'https://example.com/other',
          blockedURL: 'https://evil.com/script.js',
          effectiveDirective: 'script-src',
          originalPolicy: "default-src 'self'",
          disposition: 'enforce',
          statusCode: 200,
          sample: 'var x = 1;',
          lineNumber: 10,
          columnNumber: 5,
          sourceFile: 'https://example.com/app.js',
        },
      };

      const converted = convertReportingAPIFormat(reportingAPIReport);

      expect(converted['csp-report']['document-uri']).toBe(
        'https://example.com/page'
      );
      expect(converted['csp-report']['referrer']).toBe(
        'https://example.com/other'
      );
      expect(converted['csp-report']['blocked-uri']).toBe(
        'https://evil.com/script.js'
      );
      expect(converted['csp-report']['effective-directive']).toBe('script-src');
      expect(converted['csp-report']['disposition']).toBe('enforce');
      expect(converted['csp-report']['script-sample']).toBe('var x = 1;');
      expect(converted['csp-report']['line-number']).toBe(10);
      expect(converted['csp-report']['column-number']).toBe(5);
    });
  });

  describe('handleCSPReport', () => {
    it('should process valid legacy reports', () => {
      const report: CSPViolationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'referrer': '',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce',
          'blocked-uri': 'https://evil.com/script.js',
          'status-code': 0,
        },
      };

      const result = handleCSPReport(report);

      expect(result).not.toBeNull();
      expect(result?.effectiveDirective).toBe('script-src');
      expect(result?.blockedDomain).toBe('evil.com');
    });

    it('should process valid Reporting API reports', () => {
      const report: ReportingAPIReport = {
        type: 'csp-violation',
        url: 'https://example.com/page',
        user_agent: 'Mozilla/5.0',
        body: {
          documentURL: 'https://example.com/page',
          referrer: '',
          blockedURL: 'https://evil.com/script.js',
          effectiveDirective: 'script-src',
          originalPolicy: "default-src 'self'",
          disposition: 'enforce',
          statusCode: 0,
        },
      };

      const result = handleCSPReport(report);

      expect(result).not.toBeNull();
      expect(result?.effectiveDirective).toBe('script-src');
    });

    it('should return null for invalid reports', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = handleCSPReport({ invalid: 'report' });

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid report format')
      );
    });

    it('should return null when rate limited', () => {
      const sourceId = 'rate-limit-test';

      // Exhaust rate limit
      for (let i = 0; i < CSP_REPORT_RATE_LIMITER_CONFIG.maxReports; i++) {
        handleCSPReport(createValidReport(), sourceId);
      }

      // Next should be rate limited
      const result = handleCSPReport(createValidReport(), sourceId);
      expect(result).toBeNull();
    });

    it('should call registered handlers', () => {
      const handler = vi.fn();
      registerViolationHandler(handler);

      const report = createValidReport();
      handleCSPReport(report);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ effectiveDirective: 'script-src' }),
        report
      );
    });

    it('should call multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      registerViolationHandler(handler1);
      registerViolationHandler(handler2);

      handleCSPReport(createValidReport());

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should continue calling handlers even if one throws', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler1 = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const handler2 = vi.fn();

      registerViolationHandler(handler1);
      registerViolationHandler(handler2);

      handleCSPReport(createValidReport());

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('clearViolationHandlers', () => {
    it('should clear all registered handlers', () => {
      const handler = vi.fn();
      registerViolationHandler(handler);

      clearViolationHandlers();
      handleCSPReport(createValidReport());

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('createViolationStatistics', () => {
    it('should compute statistics from violations', () => {
      const violations: SanitizedViolation[] = [
        {
          timestamp: new Date().toISOString(),
          violatedDirective: 'script-src',
          effectiveDirective: 'script-src',
          disposition: 'enforce',
          blockedResourceType: 'script',
          blockedDomain: 'evil.com',
          hasScriptSample: false,
        },
        {
          timestamp: new Date().toISOString(),
          violatedDirective: 'script-src',
          effectiveDirective: 'script-src',
          disposition: 'enforce',
          blockedResourceType: 'script',
          blockedDomain: 'malicious.com',
          hasScriptSample: true,
        },
        {
          timestamp: new Date().toISOString(),
          violatedDirective: 'style-src',
          effectiveDirective: 'style-src',
          disposition: 'report',
          blockedResourceType: 'style',
          blockedDomain: 'evil.com',
          hasScriptSample: false,
        },
      ];

      const stats = createViolationStatistics(violations);

      expect(stats.total).toBe(3);
      expect(stats.byDirective['script-src']).toBe(2);
      expect(stats.byDirective['style-src']).toBe(1);
      expect(stats.byDomain['evil.com']).toBe(2);
      expect(stats.byDomain['malicious.com']).toBe(1);
      expect(stats.byResourceType['script']).toBe(2);
      expect(stats.byResourceType['style']).toBe(1);
      expect(stats.enforced).toBe(2);
      expect(stats.reportOnly).toBe(1);
    });

    it('should handle empty violations array', () => {
      const stats = createViolationStatistics([]);

      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byDirective)).toHaveLength(0);
      expect(Object.keys(stats.byDomain)).toHaveLength(0);
      expect(stats.enforced).toBe(0);
      expect(stats.reportOnly).toBe(0);
    });
  });

  // Helper function to create a valid report for testing
  function createValidReport(): CSPViolationReport {
    return {
      'csp-report': {
        'document-uri': 'https://example.com/page',
        'referrer': '',
        'violated-directive': 'script-src',
        'effective-directive': 'script-src',
        'original-policy': "default-src 'self'",
        'disposition': 'enforce',
        'blocked-uri': 'https://evil.com/script.js',
        'status-code': 0,
      },
    };
  }
});
