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

export {
  // API Configuration
  API_URL,
  SYNC_URL,
  STRIPE_PUBLIC_KEY,
  APP_NAME,
  APP_ENV,
  DEBUG_MODE,
  MOCK_API,
  DISABLE_ENCRYPTION,
  ANALYTICS_ENABLED,
  SENTRY_DSN,
  isProduction,
  isDevelopment,
  isStaging,
  apiConfig,
  validateProductionConfig,
} from './api';
