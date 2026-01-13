/**
 * Users Schema Definition
 *
 * Defines the structure for user profiles, preferences, companies, and sessions.
 * Supports zero-knowledge architecture with encrypted master keys.
 *
 * Requirements:
 * - User authentication and profile management
 * - ARCH-002: Zero-knowledge encryption
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type {
  User,
  UserPreferences,
  Company,
  CompanySettings,
  CompanyUser,
  UserRole,
  Session,
  Device,
} from '../../types/database.types';

/**
 * Dexie.js schema definition for Users table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - email: For login lookup (UNIQUE, encrypted but searchable via hash)
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const usersSchema = 'id, email, updated_at, deleted_at';

/**
 * Dexie.js schema definition for Companies table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - updated_at: For CRDT conflict resolution
 */
export const companiesSchema = 'id, updated_at, deleted_at';

/**
 * Dexie.js schema definition for CompanyUsers table
 * Links users to companies with roles
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying users by company
 * - user_id: For querying companies by user
 * - [company_id+user_id]: Compound index for access checks
 * - role: For querying by role
 * - active: For querying only active memberships
 */
export const companyUsersSchema = 'id, company_id, user_id, [company_id+user_id], role, active, updated_at, deleted_at';

/**
 * Dexie.js schema definition for Sessions table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying sessions by user
 * - token: For session lookup (UNIQUE)
 * - device_id: For device-based session management
 * - expires_at: For cleaning up expired sessions
 */
export const sessionsSchema = 'id, user_id, token, device_id, expires_at, updated_at, deleted_at';

/**
 * Dexie.js schema definition for Devices table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - user_id: For querying devices by user
 * - device_id: For device lookup (UNIQUE)
 * - trusted: For querying trusted devices
 */
export const devicesSchema = 'id, user_id, device_id, trusted, updated_at, deleted_at';

/**
 * Table name constants
 */
export const USERS_TABLE = 'users';
export const COMPANIES_TABLE = 'companies';
export const COMPANY_USERS_TABLE = 'company_users';
export const SESSIONS_TABLE = 'sessions';
export const DEVICES_TABLE = 'devices';

/**
 * Default values for new User
 */
export const createDefaultUser = (
  email: string,
  name: string,
  passphraseHash: string,
  masterKeyEncrypted: string,
  deviceId: string
): Partial<User> => {
  const now = Date.now();

  const defaultPreferences: UserPreferences = {
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    date_format: 'MM/DD/YYYY',
    currency_display: '$1,000.00',
    theme: 'auto',
    reduced_motion: false,
    high_contrast: false,
  };

  return {
    email,
    name,
    passphrase_hash: passphraseHash,
    master_key_encrypted: masterKeyEncrypted,
    preferences: defaultPreferences,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new Company
 */
export const createDefaultCompany = (
  name: string,
  currency: string,
  deviceId: string
): Partial<Company> => {
  const now = Date.now();

  const defaultSettings: CompanySettings = {
    accounting_method: 'accrual',
    multi_currency: false,
    track_inventory: false,
    auto_backup: true,
    retention_period_days: 2555, // ~7 years (default for tax records)
  };

  return {
    name,
    legal_name: null,
    tax_id: null,
    address: null,
    phone: null,
    email: null,
    fiscal_year_end: '12-31', // Default to calendar year
    currency,
    settings: defaultSettings,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new CompanyUser
 */
export const createDefaultCompanyUser = (
  companyId: string,
  userId: string,
  role: UserRole,
  deviceId: string
): Partial<CompanyUser> => {
  const now = Date.now();

  return {
    company_id: companyId,
    user_id: userId,
    role,
    permissions: getDefaultPermissionsForRole(role),
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new Session
 */
export const createDefaultSession = (
  userId: string,
  token: string,
  deviceId: string,
  expiresInMs: number = 24 * 60 * 60 * 1000, // 24 hours default
  rememberDevice: boolean = false
): Partial<Session> => {
  const now = Date.now();

  return {
    user_id: userId,
    company_id: null,
    token,
    device_id: deviceId,
    device_name: null,
    ip_address: null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    expires_at: now + expiresInMs,
    last_activity_at: now,
    remember_device: rememberDevice,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new Device
 */
export const createDefaultDevice = (
  userId: string,
  deviceId: string,
  deviceName: string,
  deviceType: 'browser' | 'desktop' | 'mobile'
): Partial<Device> => {
  const now = Date.now();

  return {
    user_id: userId,
    device_id: deviceId,
    device_name: deviceName,
    device_type: deviceType,
    last_sync_at: null,
    sync_vector: {},
    trusted: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Get default permissions for a role
 */
export const getDefaultPermissionsForRole = (role: UserRole): string[] => {
  const permissions: Record<UserRole, string[]> = {
    OWNER: [
      'accounts.create',
      'accounts.read',
      'accounts.update',
      'accounts.delete',
      'transactions.create',
      'transactions.read',
      'transactions.update',
      'transactions.delete',
      'contacts.create',
      'contacts.read',
      'contacts.update',
      'contacts.delete',
      'products.create',
      'products.read',
      'products.update',
      'products.delete',
      'reports.read',
      'reports.export',
      'users.create',
      'users.read',
      'users.update',
      'users.delete',
      'company.update',
      'company.delete',
    ],
    ADMIN: [
      'accounts.create',
      'accounts.read',
      'accounts.update',
      'accounts.delete',
      'transactions.create',
      'transactions.read',
      'transactions.update',
      'transactions.delete',
      'contacts.create',
      'contacts.read',
      'contacts.update',
      'contacts.delete',
      'products.create',
      'products.read',
      'products.update',
      'products.delete',
      'reports.read',
      'reports.export',
      'users.create',
      'users.read',
      'users.update',
      'company.update',
    ],
    ACCOUNTANT: [
      'accounts.read',
      'accounts.update',
      'transactions.create',
      'transactions.read',
      'transactions.update',
      'contacts.read',
      'products.read',
      'reports.read',
      'reports.export',
    ],
    BOOKKEEPER: [
      'accounts.read',
      'transactions.create',
      'transactions.read',
      'transactions.update',
      'contacts.create',
      'contacts.read',
      'contacts.update',
      'products.read',
      'reports.read',
    ],
    VIEWER: [
      'accounts.read',
      'transactions.read',
      'contacts.read',
      'products.read',
      'reports.read',
    ],
  };

  return permissions[role] || [];
};

/**
 * Validation: Ensure user has valid fields
 */
export const validateUser = (user: Partial<User>): string[] => {
  const errors: string[] = [];

  if (!user.email || user.email.trim() === '') {
    errors.push('email is required');
  }

  if (user.email && !isValidEmail(user.email)) {
    errors.push('email format is invalid');
  }

  if (!user.name || user.name.trim() === '') {
    errors.push('name is required');
  }

  if (!user.passphrase_hash) {
    errors.push('passphrase_hash is required');
  }

  if (!user.master_key_encrypted) {
    errors.push('master_key_encrypted is required');
  }

  return errors;
};

/**
 * Validation: Ensure company has valid fields
 */
export const validateCompany = (company: Partial<Company>): string[] => {
  const errors: string[] = [];

  if (!company.name || company.name.trim() === '') {
    errors.push('name is required');
  }

  if (!company.currency || company.currency.trim() === '') {
    errors.push('currency is required');
  }

  // Validate currency code format (ISO 4217)
  if (company.currency && company.currency.length !== 3) {
    errors.push('currency must be a 3-letter ISO 4217 code');
  }

  return errors;
};

/**
 * Helper: Validate email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Helper: Check if session is expired
 */
export const isSessionExpired = (session: Session): boolean => {
  return Date.now() >= session.expires_at;
};

/**
 * Helper: Check if session should be renewed
 * Renew if less than 25% of session time remaining
 */
export const shouldRenewSession = (session: Session): boolean => {
  const totalDuration = session.expires_at - session.created_at;
  const remainingDuration = session.expires_at - Date.now();
  return remainingDuration < totalDuration * 0.25;
};

/**
 * Helper: Get user role display name
 */
export const getUserRoleDisplay = (role: UserRole): string => {
  const displays: Record<UserRole, string> = {
    OWNER: 'Owner',
    ADMIN: 'Administrator',
    ACCOUNTANT: 'Accountant',
    BOOKKEEPER: 'Bookkeeper',
    VIEWER: 'Viewer',
  };
  return displays[role];
};

/**
 * Helper: Check if user has permission
 */
export const hasPermission = (
  companyUser: CompanyUser,
  permission: string
): boolean => {
  return companyUser.permissions.includes(permission);
};

/**
 * Helper: Check if role has higher or equal privileges
 */
export const hasHigherOrEqualRole = (
  userRole: UserRole,
  requiredRole: UserRole
): boolean => {
  const roleHierarchy: Record<UserRole, number> = {
    OWNER: 5,
    ADMIN: 4,
    ACCOUNTANT: 3,
    BOOKKEEPER: 2,
    VIEWER: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

/**
 * Query helper: Get companies for a user
 */
export interface GetUserCompaniesQuery {
  user_id: string;
  active?: boolean;
}

/**
 * Query helper: Get users for a company
 */
export interface GetCompanyUsersQuery {
  company_id: string;
  role?: UserRole;
  active?: boolean;
}

/**
 * Session extension options
 */
export interface SessionExtensionOptions {
  extend_by_ms: number;
  update_last_activity: boolean;
}

/**
 * Device fingerprint (for device identification)
 */
export interface DeviceFingerprint {
  user_agent: string;
  screen_resolution: string;
  timezone: string;
  language: string;
  platform: string;
}

/**
 * Helper: Generate device fingerprint
 */
export const generateDeviceFingerprint = (): DeviceFingerprint | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return {
    user_agent: navigator.userAgent,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
  };
};
