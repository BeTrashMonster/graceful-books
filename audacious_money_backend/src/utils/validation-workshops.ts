/**
 * Validation schemas for workshop system
 *
 * Zod schemas for validating workshop-related API requests
 */

import { z } from 'zod';

// =============================================================================
// REUSABLE WORKSHOP SCHEMAS
// =============================================================================

/**
 * Workshop slug validation
 */
export const workshopSlugSchema = z
  .string()
  .min(1, 'Workshop slug is required')
  .max(100, 'Workshop slug must be less than 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
  .trim();

/**
 * IANA timezone validation
 */
export const timezoneSchema = z
  .string()
  .min(1, 'Timezone is required')
  .max(50, 'Timezone must be less than 50 characters');

/**
 * Workshop type validation
 */
export const workshopTypeSchema = z.enum(['in_person', 'online'], {
  errorMap: () => ({ message: 'Workshop type must be either in_person or online' }),
});

/**
 * Workshop status validation
 */
export const workshopStatusSchema = z.enum(
  ['draft', 'open_registration', 'registration_closed', 'in_progress', 'completed', 'archived'],
  {
    errorMap: () => ({ message: 'Invalid workshop status' }),
  }
);

/**
 * Post-trial action validation
 */
export const postTrialActionSchema = z.enum(['upgrade_prompt', 'auto_convert', 'account_freeze'], {
  errorMap: () => ({ message: 'Invalid post-trial action' }),
});

/**
 * Enrollment status validation
 */
export const enrollmentStatusSchema = z.enum(
  ['enrolled', 'active', 'trial_expired', 'converted', 'withdrawn'],
  {
    errorMap: () => ({ message: 'Invalid enrollment status' }),
  }
);

// =============================================================================
// EMAIL TEMPLATE SCHEMAS
// =============================================================================

/**
 * Individual email template schema
 */
export const emailTemplateSchema = z.object({
  subject: z.string().min(1, 'Email subject is required').max(200, 'Subject must be less than 200 characters'),
  preheader: z.string().max(150, 'Preheader must be less than 150 characters').optional(),
  htmlBody: z.string().min(1, 'Email body is required').max(100000, 'Email body must be less than 100KB'),
  plainTextBody: z.string().max(50000, 'Plain text body must be less than 50KB').optional(),
  fromName: z.string().max(100, 'From name must be less than 100 characters').optional(),
  fromEmail: z.string().email('Must be a valid email address').optional(),
  replyTo: z.string().email('Must be a valid email address').optional(),
});

/**
 * Complete email templates object schema
 */
export const emailTemplatesSchema = z
  .object({
    welcome: emailTemplateSchema.optional(),
    reminder: emailTemplateSchema.optional(),
    week1: emailTemplateSchema.optional(),
    week2: emailTemplateSchema.optional(),
    week3: emailTemplateSchema.optional(),
    week4: emailTemplateSchema.optional(),
    wrapUp: emailTemplateSchema.optional(),
  })
  .optional()
  .refine(
    (data) => {
      if (!data) return true;
      const jsonSize = JSON.stringify(data).length;
      return jsonSize < 500000; // 500KB total for all email templates
    },
    {
      message: 'Total email templates size must be less than 500KB',
    }
  );

/**
 * Email schedule override schema
 */
export const emailScheduleOverrideSchema = z
  .object({
    welcomeEmail: z.object({ sendAt: z.literal('signup') }).optional(),
    reminderEmail: z
      .object({
        hoursBefore: z.number().int().positive().max(168, 'Reminder must be within 1 week of workshop'),
      })
      .optional(),
    weeklyEmails: z
      .object({
        email1: z.object({ hoursAfterWorkshopStart: z.number().int().min(0).max(168) }).optional(),
        email2: z.object({ daysAfterEmail1: z.number().int().positive().max(30) }).optional(),
        email3: z.object({ daysAfterEmail2: z.number().int().positive().max(30) }).optional(),
        email4: z.object({ daysAfterEmail3: z.number().int().positive().max(30) }).optional(),
        wrapUp: z.object({ daysAfterEmail4: z.number().int().positive().max(30) }).optional(),
      })
      .optional(),
  })
  .optional();

// =============================================================================
// RESOURCE SCHEMAS
// =============================================================================

/**
 * Workshop resource schema
 */
export const workshopResourceSchema = z.object({
  title: z.string().min(1, 'Resource title is required').max(200, 'Title must be less than 200 characters'),
  url: z
    .string()
    .url('Must be a valid URL')
    .regex(/^https?:\/\//, 'URL must use HTTP or HTTPS protocol')
    .max(2048, 'URL must be less than 2048 characters'),
  type: z.enum(['recording', 'slides', 'worksheet', 'other']).optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
});

// =============================================================================
// WORKSHOP CRUD SCHEMAS
// =============================================================================

/**
 * Create workshop schema
 */
export const createWorkshopSchema = z
  .object({
    cohortName: z
      .string()
      .min(3, 'Cohort name must be at least 3 characters')
      .max(255, 'Cohort name must be less than 255 characters')
      .trim(),
    workshopName: z
      .string()
      .min(3, 'Workshop name must be at least 3 characters')
      .max(255, 'Workshop name must be less than 255 characters')
      .trim(),
    slug: workshopSlugSchema,
    description: z.string().max(2000, 'Description must be less than 2000 characters').trim().optional(),

    // Workshop Type & Location
    workshopType: workshopTypeSchema,
    location: z.string().max(500, 'Location must be less than 500 characters').trim().optional(),

    // Timezone Display
    primaryTimezone: timezoneSchema.default('America/Los_Angeles'),
    secondaryTimezone: timezoneSchema.optional(),

    // Stripe Integration
    stripePriceId: z
      .string()
      .min(1, 'Stripe Price ID is required')
      .regex(/^price_[a-zA-Z0-9]+$/, 'Must be a valid Stripe price ID (starts with price_)'),

    // Access & Trial Settings
    accessGrantDatetime: z.string().datetime('Must be a valid ISO 8601 datetime'),
    trialDurationDays: z
      .number()
      .int('Trial duration must be a whole number')
      .min(1, 'Trial must be at least 1 day')
      .max(365, 'Trial cannot exceed 365 days')
      .default(30),

    // Workshop Event Timing
    workshopStartDatetime: z.string().datetime('Must be a valid ISO 8601 datetime'),
    workshopEndDatetime: z.string().datetime('Must be a valid ISO 8601 datetime'),

    // Registration Settings
    registrationDeadline: z.string().datetime('Must be a valid ISO 8601 datetime').optional(),
    maxEnrollment: z.number().int().positive('Max enrollment must be positive').optional(),

    // Customization
    welcomeMessage: z.string().max(5000, 'Welcome message must be less than 5000 characters').optional(),
    customEmailTemplates: emailTemplatesSchema.optional(),
    postWorkshopResources: z.array(workshopResourceSchema).max(20, 'Maximum 20 resources allowed').optional(),

    // Reminder Settings
    sendReminder: z.boolean().default(true),
    reminderHoursBefore: z.number().int().positive().max(168, 'Reminder must be within 1 week').default(24),

    // Status
    status: workshopStatusSchema.default('draft'),
  })
  .refine((data) => new Date(data.workshopEndDatetime) > new Date(data.workshopStartDatetime), {
    message: 'Workshop end datetime must be after start datetime',
    path: ['workshopEndDatetime'],
  })
  .refine((data) => new Date(data.accessGrantDatetime) <= new Date(data.workshopStartDatetime), {
    message: 'Access should be granted before or at workshop start time',
    path: ['accessGrantDatetime'],
  })
  .refine(
    (data) => {
      if (!data.registrationDeadline) return true;
      return new Date(data.registrationDeadline) <= new Date(data.workshopStartDatetime);
    },
    {
      message: 'Registration deadline must be before workshop start',
      path: ['registrationDeadline'],
    }
  );

/**
 * Update workshop schema (all fields optional except validations)
 */
export const updateWorkshopSchema = z
  .object({
    cohortName: z.string().min(3).max(255).trim().optional(),
    workshopName: z.string().min(3).max(255).trim().optional(),
    slug: workshopSlugSchema.optional(),
    description: z.string().max(2000).trim().optional(),

    workshopType: workshopTypeSchema.optional(),
    location: z.string().max(500).trim().optional(),

    primaryTimezone: timezoneSchema.optional(),
    secondaryTimezone: timezoneSchema.optional(),

    stripePriceId: z.string().regex(/^price_[a-zA-Z0-9]+$/, 'Must be a valid Stripe price ID').optional(),

    accessGrantDatetime: z.string().datetime().optional(),
    trialDurationDays: z.number().int().min(1).max(365).optional(),

    workshopStartDatetime: z.string().datetime().optional(),
    workshopEndDatetime: z.string().datetime().optional(),

    registrationDeadline: z.string().datetime().optional().nullable(),
    maxEnrollment: z.number().int().positive().optional().nullable(),

    welcomeMessage: z.string().max(5000).optional().nullable(),
    customEmailTemplates: emailTemplatesSchema.optional().nullable(),
    postWorkshopResources: z.array(workshopResourceSchema).max(20).optional().nullable(),

    sendReminder: z.boolean().optional(),
    reminderHoursBefore: z.number().int().positive().max(168).optional(),

    status: workshopStatusSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.workshopStartDatetime && data.workshopEndDatetime) {
        return new Date(data.workshopEndDatetime) > new Date(data.workshopStartDatetime);
      }
      return true;
    },
    {
      message: 'Workshop end datetime must be after start datetime',
      path: ['workshopEndDatetime'],
    }
  );

// =============================================================================
// ENROLLMENT SCHEMAS
// =============================================================================

/**
 * Enroll in workshop schema
 */
export const enrollInWorkshopSchema = z.object({
  workshopSlug: workshopSlugSchema,
});

/**
 * Update enrollment status schema
 */
export const updateEnrollmentStatusSchema = z.object({
  status: enrollmentStatusSchema,
});

/**
 * Complete worksheet schema
 */
export const completeWorksheetSchema = z.object({
  workshopSlug: workshopSlugSchema,
});

// =============================================================================
// QUERY PARAMETER SCHEMAS
// =============================================================================

/**
 * List workshops query parameters
 */
export const listWorkshopsQuerySchema = z.object({
  status: workshopStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  includeArchived: z.coerce.boolean().default(false).optional(),
});

/**
 * List enrollments query parameters
 */
export const listEnrollmentsQuerySchema = z.object({
  workshopId: z.string().uuid('Invalid workshop ID').optional(),
  status: enrollmentStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

// =============================================================================
// EMAIL LOG SCHEMA
// =============================================================================

/**
 * Email log entry schema
 */
export const emailLogSchema = z.object({
  emailType: z.enum(['welcome', 'reminder', 'week1', 'week2', 'week3', 'week4', 'wrap_up']),
  sentAt: z.string().datetime(),
  successful: z.boolean(),
  errorMessage: z.string().optional(),
});
