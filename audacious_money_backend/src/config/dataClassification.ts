/**
 * Data Classification Configuration
 *
 * This file defines how user data is handled during account deletion.
 * It is the SINGLE SOURCE OF TRUTH for the anonymization service.
 *
 * IMPORTANT: When adding ANY new user data field to the system, you MUST:
 * 1. Add it to the appropriate bucket in this file
 * 2. Update the anonymization service to handle it
 * 3. Add tests to verify correct processing on deletion
 *
 * Three Buckets:
 * - DELETE: PII that gets nulled/removed on account deletion
 * - ANONYMIZE: Data that stays but links to anonymous GracefulExit ID
 * - RETAIN_AS_IS: Compliance/operational data that must remain unchanged
 */

// =============================================================================
// TYPES
// =============================================================================

export type DataBucket = 'DELETE' | 'ANONYMIZE' | 'RETAIN_AS_IS';

export interface FieldClassification {
  /** TypeScript property name (camelCase) */
  field: string;
  /** Database column name (snake_case) */
  dbColumn: string;
  /** Which bucket this field belongs to */
  bucket: DataBucket;
  /** Action to take: 'null', 'randomHash', 'setValue', 'hardDelete', 'keep' */
  action: 'null' | 'randomHash' | 'setValue' | 'hardDelete' | 'keep';
  /** Value to set (for 'setValue' action) */
  value?: string | boolean | null;
  /** Reason for this classification */
  reason: string;
}

export interface TableClassification {
  /** Table name (snake_case) */
  table: string;
  /** Foreign key column linking to users table */
  userFkColumn: string;
  /** Overall bucket for the table (can be overridden per field) */
  defaultBucket: DataBucket;
  /** Field-level classifications */
  fields: FieldClassification[];
}

// =============================================================================
// USERS TABLE
// =============================================================================

export const usersClassification: TableClassification = {
  table: 'users',
  userFkColumn: 'id',
  defaultBucket: 'ANONYMIZE',
  fields: [
    // DELETE bucket - PII that gets nulled
    {
      field: 'email',
      dbColumn: 'email',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII - primary identifier',
    },
    {
      field: 'passwordHash',
      dbColumn: 'password_hash',
      bucket: 'DELETE',
      action: 'randomHash',
      reason: 'Security credential - set to unusable random hash',
    },
    {
      field: 'firstName',
      dbColumn: 'first_name',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII',
    },
    {
      field: 'lastName',
      dbColumn: 'last_name',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII',
    },
    {
      field: 'companyName',
      dbColumn: 'company_name',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII - business name can identify',
    },

    // ANONYMIZE bucket - operational data that stays
    {
      field: 'id',
      dbColumn: 'id',
      bucket: 'ANONYMIZE',
      action: 'keep',
      reason: 'UUID remains as reference for related records',
    },
    {
      field: 'supportKey',
      dbColumn: 'support_key',
      bucket: 'ANONYMIZE',
      action: 'setValue',
      value: 'GRACEFUL_EXIT_ID', // Replaced with actual GracefulExit-xxxxxxxx
      reason: 'Replace with GracefulExit ID for admin lookup',
    },
    {
      field: 'accountStatus',
      dbColumn: 'account_status',
      bucket: 'ANONYMIZE',
      action: 'setValue',
      value: 'deleted',
      reason: 'Mark as deleted',
    },
    {
      field: 'emailVerified',
      dbColumn: 'email_verified',
      bucket: 'ANONYMIZE',
      action: 'keep',
      reason: 'Operational record',
    },
    {
      field: 'createdAt',
      dbColumn: 'created_at',
      bucket: 'ANONYMIZE',
      action: 'keep',
      reason: 'Account lifecycle data',
    },
    {
      field: 'updatedAt',
      dbColumn: 'updated_at',
      bucket: 'ANONYMIZE',
      action: 'setValue',
      value: 'NOW()', // Set to deletion timestamp
      reason: 'Update to deletion timestamp',
    },
    {
      field: 'lastLoginAt',
      dbColumn: 'last_login_at',
      bucket: 'ANONYMIZE',
      action: 'keep',
      reason: 'Operational metric',
    },
    {
      field: 'currentWorkshopEnrollmentId',
      dbColumn: 'current_workshop_enrollment_id',
      bucket: 'ANONYMIZE',
      action: 'keep',
      reason: 'Reference to enrollment record',
    },
    {
      field: 'needsAttention',
      dbColumn: 'needs_attention',
      bucket: 'ANONYMIZE',
      action: 'setValue',
      value: false,
      reason: 'Clear admin flag',
    },
    {
      field: 'needsAttentionReason',
      dbColumn: 'needs_attention_reason',
      bucket: 'ANONYMIZE',
      action: 'null',
      reason: 'Clear admin notes',
    },
    {
      field: 'stripeCustomerId',
      dbColumn: 'stripe_customer_id',
      bucket: 'ANONYMIZE',
      action: 'keep',
      reason: 'Needed for Stripe record reconciliation',
    },
    {
      field: 'isBeta',
      dbColumn: 'is_beta',
      bucket: 'ANONYMIZE',
      action: 'keep',
      reason: 'Operational flag',
    },
  ],
};

// =============================================================================
// PASSWORD RESET TOKENS - Hard delete entire records
// =============================================================================

export const passwordResetTokensClassification: TableClassification = {
  table: 'password_reset_tokens',
  userFkColumn: 'user_id',
  defaultBucket: 'DELETE',
  fields: [
    {
      field: '*',
      dbColumn: '*',
      bucket: 'DELETE',
      action: 'hardDelete',
      reason: 'No longer needed, security risk - delete entire rows',
    },
  ],
};

// =============================================================================
// EMAIL TRACKING EVENTS
// =============================================================================

export const emailTrackingEventsClassification: TableClassification = {
  table: 'email_tracking_events',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [
    {
      field: 'recipientEmail',
      dbColumn: 'recipient_email',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII',
    },
    // All other fields kept as-is (message_id, event_type, timestamps, etc.)
  ],
};

// =============================================================================
// EMAIL SUPPRESSIONS
// =============================================================================

export const emailSuppressionsClassification: TableClassification = {
  table: 'email_suppressions',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [
    {
      field: 'email',
      dbColumn: 'email',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII',
    },
    // All other fields kept as-is (suppression_type, suppressed_at, etc.)
  ],
};

// =============================================================================
// USER ACTIVITY LOG
// =============================================================================

export const userActivityLogClassification: TableClassification = {
  table: 'user_activity_log',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [
    {
      field: 'ipAddress',
      dbColumn: 'ip_address',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII - location identifying',
    },
    {
      field: 'userAgent',
      dbColumn: 'user_agent',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII - device fingerprint',
    },
    // All other fields kept as-is (activity_type, activity_name, metadata, timestamps)
  ],
};

// =============================================================================
// LIFETIME CODE REDEMPTIONS
// =============================================================================

export const lifetimeCodeRedemptionsClassification: TableClassification = {
  table: 'lifetime_code_redemptions',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [
    {
      field: 'ipAddress',
      dbColumn: 'ip_address',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII - location identifying',
    },
    {
      field: 'userAgent',
      dbColumn: 'user_agent',
      bucket: 'DELETE',
      action: 'null',
      reason: 'PII - device fingerprint',
    },
    // All other fields kept as-is (lifetime_code_id, redeemed_at)
  ],
};

// =============================================================================
// TABLES THAT STAY COMPLETELY INTACT (ANONYMIZE bucket, no PII fields)
// =============================================================================

export const userProductsClassification: TableClassification = {
  table: 'user_products',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [], // All fields kept as-is - no PII in this table
};

export const userCharitySelectionsClassification: TableClassification = {
  table: 'user_charity_selections',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [], // All fields kept as-is - no PII in this table
};

export const paymentsClassification: TableClassification = {
  table: 'payments',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [], // All fields kept as-is - no PII in this table
};

export const userNotesClassification: TableClassification = {
  table: 'user_notes',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [], // All fields kept as-is - internal support records
};

export const userTagsClassification: TableClassification = {
  table: 'user_tags',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [], // All fields kept as-is - internal categorization
};

export const affiliateConversionsClassification: TableClassification = {
  table: 'affiliate_conversions',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [], // All fields kept as-is - commission records
};

export const workshopEnrollmentsClassification: TableClassification = {
  table: 'workshop_enrollments',
  userFkColumn: 'user_id',
  defaultBucket: 'ANONYMIZE',
  fields: [], // All fields kept as-is - enrollment history
};

// =============================================================================
// TABLES IN RETAIN_AS_IS BUCKET (Immutable compliance/operational records)
// =============================================================================

export const adminAuditLogClassification: TableClassification = {
  table: 'admin_audit_log',
  userFkColumn: 'resource_id', // References user via resource_id when resource_type = 'user'
  defaultBucket: 'RETAIN_AS_IS',
  fields: [], // All fields retained - immutable compliance record
};

export const sentEmailsClassification: TableClassification = {
  table: 'sent_emails',
  userFkColumn: 'user_id',
  defaultBucket: 'RETAIN_AS_IS',
  fields: [], // All fields retained - internal operational/support records
};

export const scheduledEmailsClassification: TableClassification = {
  table: 'scheduled_emails',
  userFkColumn: 'user_id',
  defaultBucket: 'RETAIN_AS_IS',
  fields: [], // All fields retained - internal email scheduling records
};

// =============================================================================
// MASTER CLASSIFICATION MAP
// =============================================================================

export const dataClassificationMap: Record<string, TableClassification> = {
  users: usersClassification,
  password_reset_tokens: passwordResetTokensClassification,
  email_tracking_events: emailTrackingEventsClassification,
  email_suppressions: emailSuppressionsClassification,
  user_activity_log: userActivityLogClassification,
  lifetime_code_redemptions: lifetimeCodeRedemptionsClassification,
  user_products: userProductsClassification,
  user_charity_selections: userCharitySelectionsClassification,
  payments: paymentsClassification,
  user_notes: userNotesClassification,
  user_tags: userTagsClassification,
  affiliate_conversions: affiliateConversionsClassification,
  workshop_enrollments: workshopEnrollmentsClassification,
  admin_audit_log: adminAuditLogClassification,
  sent_emails: sentEmailsClassification,
  scheduled_emails: scheduledEmailsClassification,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all tables that need processing during user deletion
 */
export function getTablesForDeletion(): TableClassification[] {
  return Object.values(dataClassificationMap).filter(
    (table) => table.defaultBucket !== 'RETAIN_AS_IS'
  );
}

/**
 * Get all fields in the DELETE bucket for a given table
 */
export function getDeleteFields(tableName: string): FieldClassification[] {
  const table = dataClassificationMap[tableName];
  if (!table) return [];
  return table.fields.filter((f) => f.bucket === 'DELETE');
}

/**
 * Get all fields in the ANONYMIZE bucket for a given table
 */
export function getAnonymizeFields(tableName: string): FieldClassification[] {
  const table = dataClassificationMap[tableName];
  if (!table) return [];
  return table.fields.filter((f) => f.bucket === 'ANONYMIZE');
}

/**
 * Check if a table should be completely retained (no changes on deletion)
 */
export function isRetainedTable(tableName: string): boolean {
  const table = dataClassificationMap[tableName];
  return table?.defaultBucket === 'RETAIN_AS_IS';
}

/**
 * Get the FK column for a table
 */
export function getUserFkColumn(tableName: string): string | null {
  return dataClassificationMap[tableName]?.userFkColumn ?? null;
}
