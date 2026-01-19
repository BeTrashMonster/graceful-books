/**
 * Security Headers Configuration
 *
 * This module provides Content Security Policy (CSP) and other security header
 * configurations to protect the Graceful Books application from common web
 * security vulnerabilities including XSS, clickjacking, and content injection.
 *
 * IMPORTANT: Subresource Integrity (SRI) Note
 * ============================================
 * Graceful Books is designed to be FULLY SELF-CONTAINED with no external
 * resources loaded from CDNs. This architectural decision:
 *
 * 1. Eliminates CDN compromise attack vectors entirely
 * 2. Enables true offline-first functionality
 * 3. Prevents supply chain attacks via compromised external resources
 * 4. Aligns with our zero-knowledge encryption architecture
 *
 * If external resources become necessary in the future, they MUST include
 * SRI integrity attributes. Use scripts/generate-sri.js to generate hashes.
 *
 * The Vite build configuration includes an SRI validation plugin that will
 * warn about any external resources without integrity attributes.
 *
 * @module config/securityHeaders
 */

/**
 * Represents a single CSP directive with its name and allowed sources.
 */
export interface CSPDirective {
  /** The name of the CSP directive (e.g., 'default-src', 'script-src') */
  name: string;
  /** The allowed sources for this directive */
  sources: string[];
}

/**
 * Configuration object containing all CSP directives.
 */
export interface CSPConfig {
  /**
   * Fallback for other resource types.
   * Restricts resources to same origin by default.
   */
  'default-src': string[];

  /**
   * Controls sources for JavaScript.
   * Restricts scripts to same origin to prevent XSS attacks.
   */
  'script-src': string[];

  /**
   * Controls sources for stylesheets.
   * Allows same origin and inline styles (needed for CSS-in-JS and dynamic styling).
   * Note: 'unsafe-inline' is required for many React styling solutions.
   */
  'style-src': string[];

  /**
   * Controls sources for images.
   * Allows same origin, data URIs (for inline images), and HTTPS sources.
   */
  'img-src': string[];

  /**
   * Controls sources for fonts.
   * Restricts fonts to same origin.
   */
  'font-src': string[];

  /**
   * Controls sources for fetch, XMLHttpRequest, WebSocket, and EventSource.
   * Restricts API calls to same origin.
   */
  'connect-src': string[];

  /**
   * Restricts which URLs can embed this page in a frame.
   * Set to 'none' to prevent all framing (clickjacking protection).
   */
  'frame-ancestors': string[];

  /**
   * Restricts URLs that can be used in the document's base element.
   * Prevents base tag injection attacks.
   */
  'base-uri': string[];

  /**
   * Restricts URLs that forms can submit to.
   * Prevents form hijacking attacks.
   */
  'form-action': string[];

  /**
   * Restricts sources for plugins (Flash, Java, etc.).
   * Set to 'none' as modern applications don't need plugins.
   */
  'object-src': string[];
}

/**
 * Configuration object for all security headers.
 */
export interface SecurityHeadersConfig {
  /**
   * Content Security Policy configuration.
   */
  csp: CSPConfig;

  /**
   * X-Frame-Options header value.
   * Prevents clickjacking by controlling frame embedding.
   * @deprecated Use CSP frame-ancestors instead, but keep for legacy browser support.
   */
  xFrameOptions: string;

  /**
   * X-Content-Type-Options header value.
   * Prevents MIME type sniffing attacks.
   */
  xContentTypeOptions: string;

  /**
   * Referrer-Policy header value.
   * Controls how much referrer information is sent with requests.
   */
  referrerPolicy: string;

  /**
   * Permissions-Policy header value.
   * Controls which browser features the page can use.
   */
  permissionsPolicy: string;

  /**
   * Strict-Transport-Security header value.
   * Forces HTTPS connections for improved security.
   */
  strictTransportSecurity: string;
}

/**
 * CSP configuration with secure defaults for Graceful Books.
 *
 * @remarks
 * This configuration follows security best practices while allowing
 * the necessary functionality for a modern React application:
 * - Scripts restricted to same origin (no CDN scripts)
 * - Styles allow 'unsafe-inline' for CSS-in-JS support
 * - Images allow data URIs and HTTPS sources
 * - Frames completely disabled (clickjacking protection)
 * - No plugin support (Flash, Java, etc.)
 */
export const CSP_CONFIG: CSPConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'object-src': ["'none'"],
};

/**
 * Generates a CSP string from the configuration object.
 *
 * @param config - The CSP configuration object
 * @returns A properly formatted CSP header string
 *
 * @example
 * ```typescript
 * const cspString = generateCSPString(CSP_CONFIG);
 * // Returns: "default-src 'self'; script-src 'self'; ..."
 * ```
 */
export function generateCSPString(config: CSPConfig): string {
  const directives: string[] = [];

  for (const [directive, sources] of Object.entries(config)) {
    if (sources.length > 0) {
      directives.push(`${directive} ${sources.join(' ')}`);
    }
  }

  return directives.join('; ');
}

/**
 * Pre-generated CSP string for use in headers and meta tags.
 */
export const CSP_STRING = generateCSPString(CSP_CONFIG);

/**
 * Complete security headers configuration for the application.
 *
 * @remarks
 * These headers protect against common web vulnerabilities:
 * - CSP: Prevents XSS and data injection attacks
 * - X-Frame-Options: Prevents clickjacking (legacy browser support)
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - Referrer-Policy: Protects user privacy
 * - Permissions-Policy: Restricts browser feature access
 * - Strict-Transport-Security: Enforces HTTPS
 */
export const SECURITY_HEADERS: SecurityHeadersConfig = {
  csp: CSP_CONFIG,
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'no-referrer',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
};

/**
 * Returns all security headers as a key-value object suitable for HTTP responses.
 *
 * @returns An object with header names as keys and header values as values
 *
 * @example
 * ```typescript
 * const headers = getSecurityHeaders();
 * // Use in Express middleware:
 * Object.entries(headers).forEach(([key, value]) => {
 *   res.setHeader(key, value);
 * });
 * ```
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': CSP_STRING,
    'X-Frame-Options': SECURITY_HEADERS.xFrameOptions,
    'X-Content-Type-Options': SECURITY_HEADERS.xContentTypeOptions,
    'Referrer-Policy': SECURITY_HEADERS.referrerPolicy,
    'Permissions-Policy': SECURITY_HEADERS.permissionsPolicy,
    'Strict-Transport-Security': SECURITY_HEADERS.strictTransportSecurity,
  };
}

/**
 * Generates a CSP meta tag content string for use in HTML documents.
 * Note: Some directives like frame-ancestors cannot be enforced via meta tags
 * and require HTTP headers.
 *
 * @returns The CSP string suitable for a meta tag's content attribute
 *
 * @example
 * ```html
 * <meta http-equiv="Content-Security-Policy" content="...">
 * ```
 */
export function getCSPMetaTagContent(): string {
  // Create a copy of the config without frame-ancestors
  // frame-ancestors directive is not supported in meta tags
  const metaConfig: Partial<CSPConfig> = { ...CSP_CONFIG };
  delete (metaConfig as Record<string, string[]>)['frame-ancestors'];

  const directives: string[] = [];
  for (const [directive, sources] of Object.entries(metaConfig)) {
    if (sources && sources.length > 0) {
      directives.push(`${directive} ${sources.join(' ')}`);
    }
  }

  return directives.join('; ');
}

/**
 * Pre-generated CSP string for meta tag use (excludes frame-ancestors).
 */
export const CSP_META_TAG_CONTENT = getCSPMetaTagContent();

/**
 * CSP Reporting Configuration
 *
 * Controls how Content Security Policy violations are reported back to the server.
 * Violation reports help identify XSS attempts and misconfigured resources.
 *
 * @remarks
 * - In development, reports are logged to the console
 * - In production, reports should be sent to a monitoring service
 * - Use reportOnly mode first when testing new CSP policies
 * - Rate limiting prevents DoS via report flooding
 */
export interface CSPReportConfig {
  /**
   * When true, violations are reported but not enforced.
   * Use this mode when testing new CSP policies to avoid breaking functionality.
   */
  reportOnly: boolean;

  /**
   * The endpoint URL where violation reports are sent.
   * This is the legacy reporting mechanism using report-uri directive.
   */
  reportUri: string;

  /**
   * The reporting group name for the modern Reporting API.
   * Used with the report-to directive and Report-To header.
   */
  reportTo: string;

  /**
   * Maximum age (in seconds) for the reporting endpoint configuration.
   * Browsers will cache this configuration for the specified duration.
   */
  maxAge: number;
}

/**
 * Default CSP reporting configuration.
 *
 * @remarks
 * - reportOnly is false by default for production security
 * - Set reportOnly to true when first deploying to detect issues
 * - The report endpoint handles both legacy and modern report formats
 */
export const CSP_REPORT_CONFIG: CSPReportConfig = {
  // Report-only mode for testing (doesn't block, just reports)
  // Set to true when first deploying new CSP rules
  reportOnly: false,

  // Reporting endpoint (relative to application root)
  reportUri: '/api/csp-report',

  // Modern report-to group name
  reportTo: 'csp-endpoint',

  // Cache reporting config for ~126 days
  maxAge: 10886400,
};

/**
 * Generates the Report-To header value for the Reporting API.
 *
 * @param config - The CSP report configuration
 * @returns A JSON string for the Report-To header
 *
 * @remarks
 * The Reporting API is the modern replacement for report-uri.
 * It provides better queuing and batching of reports.
 *
 * @example
 * ```typescript
 * const reportToHeader = generateReportToHeader(CSP_REPORT_CONFIG);
 * // Returns: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"/api/csp-report"}]}
 * ```
 */
export function generateReportToHeader(config: CSPReportConfig): string {
  return JSON.stringify({
    group: config.reportTo,
    max_age: config.maxAge,
    endpoints: [{ url: config.reportUri }],
  });
}

/**
 * Generates the CSP string with reporting directives included.
 *
 * @param cspConfig - The CSP configuration object
 * @param reportConfig - The CSP report configuration
 * @returns A CSP string with report-uri and report-to directives
 *
 * @example
 * ```typescript
 * const cspWithReporting = generateCSPStringWithReporting(CSP_CONFIG, CSP_REPORT_CONFIG);
 * // Returns: "default-src 'self'; ... report-uri /api/csp-report; report-to csp-endpoint"
 * ```
 */
export function generateCSPStringWithReporting(
  cspConfig: CSPConfig,
  reportConfig: CSPReportConfig
): string {
  const baseCSP = generateCSPString(cspConfig);

  // Add reporting directives
  const reportingDirectives = [
    `report-uri ${reportConfig.reportUri}`,
    `report-to ${reportConfig.reportTo}`,
  ];

  return `${baseCSP}; ${reportingDirectives.join('; ')}`;
}

/**
 * Pre-generated CSP string with reporting directives.
 */
export const CSP_STRING_WITH_REPORTING = generateCSPStringWithReporting(
  CSP_CONFIG,
  CSP_REPORT_CONFIG
);

/**
 * Returns all security headers including CSP reporting headers.
 *
 * @param includeReporting - Whether to include CSP reporting (default: true)
 * @returns An object with header names as keys and header values as values
 *
 * @remarks
 * This function extends getSecurityHeaders() to include:
 * - CSP with report-uri and report-to directives
 * - Report-To header for the Reporting API
 * - Optionally Content-Security-Policy-Report-Only for testing
 *
 * @example
 * ```typescript
 * const headers = getSecurityHeadersWithReporting();
 * // Use in Express middleware:
 * Object.entries(headers).forEach(([key, value]) => {
 *   res.setHeader(key, value);
 * });
 * ```
 */
export function getSecurityHeadersWithReporting(
  includeReporting = true
): Record<string, string> {
  const baseHeaders = getSecurityHeaders();

  if (!includeReporting) {
    return baseHeaders;
  }

  const headers: Record<string, string> = {
    ...baseHeaders,
    'Report-To': generateReportToHeader(CSP_REPORT_CONFIG),
  };

  // Use report-only header when in testing mode
  if (CSP_REPORT_CONFIG.reportOnly) {
    // Remove the enforcing CSP and use report-only instead
    delete headers['Content-Security-Policy'];
    headers['Content-Security-Policy-Report-Only'] = CSP_STRING_WITH_REPORTING;
  } else {
    // Use the CSP with reporting directives
    headers['Content-Security-Policy'] = CSP_STRING_WITH_REPORTING;
  }

  return headers;
}
