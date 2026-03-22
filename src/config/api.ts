/**
 * API Configuration
 *
 * Centralized configuration for API endpoints and external services.
 * Uses environment variables for different deployment environments.
 *
 * @module config/api
 */

/**
 * API base URL
 * Production: https://api.audacious.money
 * Development: http://localhost:3001
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * WebSocket sync relay URL
 * Production: wss://sync.audacious.money
 * Development: ws://localhost:8080
 */
export const SYNC_URL = import.meta.env.VITE_SYNC_URL || 'ws://localhost:8080';

/**
 * Stripe publishable key
 * Production: pk_live_...
 * Development: pk_test_...
 */
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || '';

/**
 * Application name
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Audacious Money';

/**
 * Current environment
 */
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';

/**
 * Debug mode flag
 */
export const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === 'true';

/**
 * Mock API flag (for offline development)
 */
export const MOCK_API = import.meta.env.VITE_MOCK_API === 'true';

/**
 * Encryption disabled flag (NEVER use in production)
 */
export const DISABLE_ENCRYPTION = import.meta.env.VITE_DISABLE_ENCRYPTION === 'true';

/**
 * Analytics enabled flag
 */
export const ANALYTICS_ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';

/**
 * Sentry DSN for error tracking
 */
export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

/**
 * Check if running in production environment
 */
export const isProduction = APP_ENV === 'production';

/**
 * Check if running in development environment
 */
export const isDevelopment = APP_ENV === 'development';

/**
 * Check if running in staging environment
 */
export const isStaging = APP_ENV === 'staging';

/**
 * API configuration object
 */
export const apiConfig = {
  baseURL: API_URL,
  syncURL: SYNC_URL,
  stripePublicKey: STRIPE_PUBLIC_KEY,
  appName: APP_NAME,
  environment: APP_ENV,
  debugMode: DEBUG_MODE,
  mockApi: MOCK_API,
  disableEncryption: DISABLE_ENCRYPTION,
  analyticsEnabled: ANALYTICS_ENABLED,
  sentryDsn: SENTRY_DSN,
  isProduction,
  isDevelopment,
  isStaging,
} as const;

/**
 * Validate critical production settings
 * Throws error if production environment is misconfigured
 */
export function validateProductionConfig(): void {
  if (!isProduction) {
    return;
  }

  // Ensure HTTPS in production
  if (!API_URL.startsWith('https://')) {
    throw new Error(
      'SECURITY ERROR: API_URL must use HTTPS in production. ' +
      `Current value: ${API_URL}`
    );
  }

  // Ensure WSS in production
  if (!SYNC_URL.startsWith('wss://')) {
    throw new Error(
      'SECURITY ERROR: SYNC_URL must use WSS (secure WebSocket) in production. ' +
      `Current value: ${SYNC_URL}`
    );
  }

  // Ensure encryption is enabled in production
  if (DISABLE_ENCRYPTION) {
    throw new Error(
      'SECURITY ERROR: Encryption cannot be disabled in production. ' +
      'Set VITE_DISABLE_ENCRYPTION=false'
    );
  }

  // Ensure mock API is disabled in production
  if (MOCK_API) {
    throw new Error(
      'SECURITY ERROR: Mock API cannot be enabled in production. ' +
      'Set VITE_MOCK_API=false'
    );
  }

  // Warn if Stripe key is missing or placeholder
  if (!STRIPE_PUBLIC_KEY || STRIPE_PUBLIC_KEY.includes('PLACEHOLDER')) {
    console.warn(
      'WARNING: Stripe public key is not configured. ' +
      'Payments will not work. Set VITE_STRIPE_PUBLIC_KEY in .env.production'
    );
  }

  // Ensure Stripe uses live key in production
  if (STRIPE_PUBLIC_KEY && !STRIPE_PUBLIC_KEY.startsWith('pk_live_')) {
    console.warn(
      'WARNING: Stripe key should start with pk_live_ in production. ' +
      `Current key starts with: ${STRIPE_PUBLIC_KEY.substring(0, 8)}...`
    );
  }
}

// Run validation on module load
if (typeof window !== 'undefined') {
  try {
    validateProductionConfig();
  } catch (error) {
    console.error(error);
    // In production, halt execution if configuration is invalid
    if (isProduction) {
      throw error;
    }
  }
}
