/**
 * CSP Violation Report Handler
 *
 * Receives and processes Content Security Policy violation reports for security monitoring.
 * In production, these reports would be forwarded to a logging/monitoring service.
 *
 * IMPORTANT: This handler does not expose sensitive information from reports.
 * Reports may contain user-related URLs which should be handled carefully.
 *
 * @module api/cspReportHandler
 */

/**
 * Standard CSP violation report format (legacy report-uri).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy-Report-Only
 */
export interface CSPViolationReport {
  'csp-report': {
    /** The URI of the document in which the violation occurred */
    'document-uri': string;
    /** The referrer of the document */
    'referrer': string;
    /** The directive that was violated */
    'violated-directive': string;
    /** The effective directive that was violated (may differ from violated-directive) */
    'effective-directive': string;
    /** The full original CSP policy */
    'original-policy': string;
    /** Either "enforce" or "report" (for report-only mode) */
    'disposition': 'enforce' | 'report';
    /** The URI of the resource that was blocked */
    'blocked-uri': string;
    /** HTTP status code of the resource */
    'status-code': number;
    /** A sample of the script that triggered the violation (if available) */
    'script-sample'?: string;
    /** Line number where violation occurred (if available) */
    'line-number'?: number;
    /** Column number where violation occurred (if available) */
    'column-number'?: number;
    /** The source file where the violation occurred (if available) */
    'source-file'?: string;
  };
}

/**
 * Modern Reporting API format for CSP violations.
 *
 * @see https://w3c.github.io/reporting/
 */
export interface ReportingAPIReport {
  /** The type of report (always "csp-violation" for CSP reports) */
  type: 'csp-violation';
  /** The URL of the document where the violation occurred */
  url: string;
  /** The user agent string */
  'user_agent': string;
  /** The report body containing violation details */
  body: {
    'documentURL': string;
    'referrer': string;
    'blockedURL': string;
    'effectiveDirective': string;
    'originalPolicy': string;
    'sourceFile'?: string;
    'sample'?: string;
    'disposition': 'enforce' | 'report';
    'statusCode': number;
    'lineNumber'?: number;
    'columnNumber'?: number;
  };
}

/**
 * Sanitized violation data for logging and monitoring.
 * Removes potentially sensitive information before storage/transmission.
 */
export interface SanitizedViolation {
  /** Timestamp of when the violation was processed */
  timestamp: string;
  /** The directive that was violated */
  violatedDirective: string;
  /** The effective directive */
  effectiveDirective: string;
  /** Whether the violation was blocked or just reported */
  disposition: 'enforce' | 'report';
  /** The blocked resource type (extracted from blocked-uri) */
  blockedResourceType: string;
  /** The blocked resource domain (sanitized) */
  blockedDomain: string;
  /** Whether a script sample was included */
  hasScriptSample: boolean;
  /** Source location if available */
  sourceLocation?: {
    file: string;
    line?: number;
    column?: number;
  };
}

/**
 * Rate limiter configuration for CSP reports.
 *
 * Prevents denial of service attacks via report flooding.
 * Legitimate violations are typically infrequent; a flood of reports
 * may indicate an attack or serious misconfiguration.
 */
export interface CSPReportRateLimiterConfig {
  /** Maximum number of reports allowed within the time window */
  maxReports: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Whether to log when rate limit is exceeded */
  logOnExceed: boolean;
}

/**
 * Default rate limiter configuration.
 *
 * Allows 100 reports per minute per client.
 * This is generous enough for legitimate violations but
 * prevents report flooding attacks.
 */
export const CSP_REPORT_RATE_LIMITER_CONFIG: CSPReportRateLimiterConfig = {
  maxReports: 100,
  windowMs: 60000, // 1 minute
  logOnExceed: true,
};

/**
 * In-memory rate limiter for CSP reports.
 *
 * Tracks report counts per source to prevent flooding.
 * In a production distributed system, this would use Redis or similar.
 */
class CSPReportRateLimiter {
  private counts: Map<string, { count: number; windowStart: number }> = new Map();
  private config: CSPReportRateLimiterConfig;

  constructor(config: CSPReportRateLimiterConfig = CSP_REPORT_RATE_LIMITER_CONFIG) {
    this.config = config;
  }

  /**
   * Check if a report from the given source should be allowed.
   *
   * @param sourceId - A unique identifier for the report source (e.g., IP address hash)
   * @returns true if the report should be processed, false if rate limited
   */
  shouldAllow(sourceId: string): boolean {
    const now = Date.now();
    const record = this.counts.get(sourceId);

    if (!record || now - record.windowStart >= this.config.windowMs) {
      // New window
      this.counts.set(sourceId, { count: 1, windowStart: now });
      return true;
    }

    if (record.count >= this.config.maxReports) {
      if (this.config.logOnExceed) {
        console.warn(`[CSP Report Rate Limit] Exceeded for source: ${sourceId}`);
      }
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Reset the rate limiter state.
   * Useful for testing and maintenance.
   */
  reset(): void {
    this.counts.clear();
  }

  /**
   * Get current count for a source (for monitoring/debugging).
   */
  getCount(sourceId: string): number {
    return this.counts.get(sourceId)?.count ?? 0;
  }
}

// Singleton instance for the application
export const cspReportRateLimiter = new CSPReportRateLimiter();

/**
 * Extract a sanitized domain from a URL.
 *
 * @param uri - The URI to extract domain from
 * @returns The domain or a placeholder for special URIs
 */
function extractDomain(uri: string): string {
  if (!uri) return 'unknown';
  if (uri === 'inline') return 'inline';
  if (uri === 'eval') return 'eval';
  if (uri === 'data') return 'data';
  if (uri === 'blob') return 'blob';

  try {
    const url = new URL(uri);
    return url.hostname;
  } catch {
    // May be a relative URI or malformed
    return 'malformed-uri';
  }
}

/**
 * Determine the resource type from a blocked URI.
 *
 * @param uri - The blocked URI
 * @param directive - The violated directive
 * @returns A human-readable resource type
 */
function determineResourceType(uri: string, directive: string): string {
  // Check directive first for accuracy
  if (directive.includes('script')) return 'script';
  if (directive.includes('style')) return 'style';
  if (directive.includes('img')) return 'image';
  if (directive.includes('font')) return 'font';
  if (directive.includes('connect')) return 'connection';
  if (directive.includes('frame')) return 'frame';
  if (directive.includes('object')) return 'object';

  // Fallback to URI inspection
  if (uri === 'inline') return 'inline-content';
  if (uri === 'eval') return 'eval-script';

  return 'unknown';
}

/**
 * Sanitize a violation report for safe logging.
 *
 * Removes potentially sensitive information like full URLs,
 * user data, and script samples while preserving useful
 * security monitoring information.
 *
 * @param report - The raw CSP violation report
 * @returns A sanitized version safe for logging
 */
export function sanitizeViolationReport(report: CSPViolationReport): SanitizedViolation {
  const cspReport = report['csp-report'];

  const sanitized: SanitizedViolation = {
    timestamp: new Date().toISOString(),
    violatedDirective: cspReport['violated-directive'],
    effectiveDirective: cspReport['effective-directive'],
    disposition: cspReport['disposition'],
    blockedResourceType: determineResourceType(
      cspReport['blocked-uri'],
      cspReport['effective-directive']
    ),
    blockedDomain: extractDomain(cspReport['blocked-uri']),
    hasScriptSample: !!cspReport['script-sample'],
  };

  // Include source location if available (useful for debugging)
  if (cspReport['source-file']) {
    sanitized.sourceLocation = {
      file: extractDomain(cspReport['source-file']),
      line: cspReport['line-number'],
      column: cspReport['column-number'],
    };
  }

  return sanitized;
}

/**
 * Converts a modern Reporting API report to the legacy format for unified processing.
 *
 * @param report - The Reporting API format report
 * @returns A legacy format CSPViolationReport
 */
export function convertReportingAPIFormat(report: ReportingAPIReport): CSPViolationReport {
  return {
    'csp-report': {
      'document-uri': report.body.documentURL,
      'referrer': report.body.referrer,
      'violated-directive': report.body.effectiveDirective,
      'effective-directive': report.body.effectiveDirective,
      'original-policy': report.body.originalPolicy,
      'disposition': report.body.disposition,
      'blocked-uri': report.body.blockedURL,
      'status-code': report.body.statusCode,
      'script-sample': report.body.sample,
      'line-number': report.body.lineNumber,
      'column-number': report.body.columnNumber,
      'source-file': report.body.sourceFile,
    },
  };
}

/**
 * Type guard to check if a report is in legacy format.
 */
export function isLegacyReport(report: unknown): report is CSPViolationReport {
  return (
    typeof report === 'object' &&
    report !== null &&
    'csp-report' in report &&
    typeof (report as CSPViolationReport)['csp-report'] === 'object'
  );
}

/**
 * Type guard to check if a report is in Reporting API format.
 */
export function isReportingAPIReport(report: unknown): report is ReportingAPIReport {
  return (
    typeof report === 'object' &&
    report !== null &&
    'type' in report &&
    (report as ReportingAPIReport).type === 'csp-violation' &&
    'body' in report
  );
}

/**
 * Callback type for violation handlers.
 */
export type ViolationHandler = (sanitized: SanitizedViolation, raw: CSPViolationReport) => void;

// Registered violation handlers
const violationHandlers: ViolationHandler[] = [];

/**
 * Register a handler to be called when violations are processed.
 *
 * @param handler - The handler function to register
 *
 * @example
 * ```typescript
 * // Send violations to Sentry
 * registerViolationHandler((sanitized) => {
 *   Sentry.captureMessage('CSP Violation', {
 *     level: 'warning',
 *     extra: sanitized,
 *   });
 * });
 * ```
 */
export function registerViolationHandler(handler: ViolationHandler): void {
  violationHandlers.push(handler);
}

/**
 * Clear all registered violation handlers.
 * Primarily useful for testing.
 */
export function clearViolationHandlers(): void {
  violationHandlers.length = 0;
}

/**
 * Handle a CSP violation report.
 *
 * This function:
 * 1. Validates the report format
 * 2. Sanitizes sensitive information
 * 3. Logs the violation (in development)
 * 4. Calls any registered violation handlers
 *
 * @param report - The raw violation report (either legacy or Reporting API format)
 * @param sourceId - Optional source identifier for rate limiting
 * @returns The sanitized violation data, or null if rate limited/invalid
 *
 * @example
 * ```typescript
 * // In an Express route handler
 * app.post('/api/csp-report', (req, res) => {
 *   const result = handleCSPReport(req.body, req.ip);
 *   res.status(result ? 204 : 429).end();
 * });
 * ```
 */
export function handleCSPReport(
  report: unknown,
  sourceId = 'default'
): SanitizedViolation | null {
  // Rate limit check
  if (!cspReportRateLimiter.shouldAllow(sourceId)) {
    return null;
  }

  // Normalize report format
  let normalizedReport: CSPViolationReport;

  if (isLegacyReport(report)) {
    normalizedReport = report;
  } else if (isReportingAPIReport(report)) {
    normalizedReport = convertReportingAPIFormat(report);
  } else {
    console.warn('[CSP Report] Invalid report format received');
    return null;
  }

  // Sanitize the report
  const sanitized = sanitizeViolationReport(normalizedReport);

  // Log in development
  if (import.meta.env.DEV) {
    console.warn('[CSP Violation]', {
      directive: sanitized.effectiveDirective,
      blockedDomain: sanitized.blockedDomain,
      resourceType: sanitized.blockedResourceType,
      disposition: sanitized.disposition,
    });
  }

  // Call registered handlers
  for (const handler of violationHandlers) {
    try {
      handler(sanitized, normalizedReport);
    } catch (error) {
      console.error('[CSP Report] Handler error:', error);
    }
  }

  return sanitized;
}

/**
 * Create statistics from collected violations.
 *
 * Useful for dashboards and monitoring.
 *
 * @param violations - Array of sanitized violations
 * @returns Statistics about the violations
 */
export function createViolationStatistics(violations: SanitizedViolation[]): {
  total: number;
  byDirective: Record<string, number>;
  byDomain: Record<string, number>;
  byResourceType: Record<string, number>;
  enforced: number;
  reportOnly: number;
} {
  const stats = {
    total: violations.length,
    byDirective: {} as Record<string, number>,
    byDomain: {} as Record<string, number>,
    byResourceType: {} as Record<string, number>,
    enforced: 0,
    reportOnly: 0,
  };

  for (const v of violations) {
    // Count by directive
    stats.byDirective[v.effectiveDirective] =
      (stats.byDirective[v.effectiveDirective] ?? 0) + 1;

    // Count by domain
    stats.byDomain[v.blockedDomain] =
      (stats.byDomain[v.blockedDomain] ?? 0) + 1;

    // Count by resource type
    stats.byResourceType[v.blockedResourceType] =
      (stats.byResourceType[v.blockedResourceType] ?? 0) + 1;

    // Count by disposition
    if (v.disposition === 'enforce') {
      stats.enforced++;
    } else {
      stats.reportOnly++;
    }
  }

  return stats;
}
