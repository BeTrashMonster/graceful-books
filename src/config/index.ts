/**
 * Configuration module exports
 *
 * @module config
 */

export {
  // Types
  type CSPDirective,
  type CSPConfig,
  type SecurityHeadersConfig,
  // Constants
  CSP_CONFIG,
  CSP_STRING,
  CSP_META_TAG_CONTENT,
  SECURITY_HEADERS,
  // Functions
  generateCSPString,
  getSecurityHeaders,
  getCSPMetaTagContent,
} from './securityHeaders';
