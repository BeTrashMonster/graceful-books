/**
 * Demo Configuration
 *
 * Centralized configuration for demo/test data to ensure consistency
 * across all demo scripts, utilities, and test files.
 *
 * IMPORTANT: All demo data creation MUST use these constants.
 * Never hardcode demo IDs directly in your code.
 */

export const DEMO_CONFIG = {
  /**
   * Demo company/user ID
   * Used as both company_id and user.id in demo sessions
   */
  COMPANY_ID: 'demo-user-cpg',

  /**
   * Demo device ID
   */
  DEVICE_ID: 'demo-device-cpg',

  /**
   * Demo user email
   */
  USER_EMAIL: 'demo@cpgdemo.com',

  /**
   * Demo user name
   */
  USER_NAME: 'CPG Demo User',

  /**
   * Demo company name
   */
  COMPANY_NAME: 'Demo CPG Company',
} as const;

/**
 * Legacy company IDs that may exist in old data
 * Use this list to identify data that needs migration
 */
export const LEGACY_DEMO_IDS = [
  'cpg-demo',
  'demo-company-cpg',
  'demo-company-id',
  'demo-user-id',
] as const;
