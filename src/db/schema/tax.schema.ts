/**
 * Tax Preparation Schema
 *
 * Database schema for J8 Tax Time Preparation Mode
 * Stores tax documents, prep sessions, and advisor access records
 */

// Tax documents uploaded by user
export const taxDocumentsSchema = 'id, userId, taxYear, categoryId, [userId+taxYear], [userId+taxYear+categoryId], uploadedAt'

// Tax category status tracking (N/A, In Progress, Complete)
export const taxCategoryStatusSchema = 'id, [userId+taxYear+categoryId], userId, taxYear, categoryId'

// Tax prep sessions (activation and completion tracking)
export const taxPrepSessionsSchema = 'id, userId, taxYear, [userId+taxYear], status, activatedAt'

// Tax advisor access for J7 integration
export const taxAdvisorAccessSchema = 'id, clientUserId, advisorUserId, taxYear, [clientUserId+taxYear], [advisorUserId+taxYear], status, grantedAt'

// Tax packages generated for export
export const taxPackagesSchema = 'id, userId, taxYear, [userId+taxYear], generatedAt'
