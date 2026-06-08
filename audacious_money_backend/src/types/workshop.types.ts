/**
 * Workshop system type definitions
 *
 * Types for educational workshop cohort management system
 */

// =============================================================================
// CORE WORKSHOP TYPES
// =============================================================================

/**
 * Workshop cohort configuration
 */
export interface Workshop {
  id: string;
  cohortName: string;
  slug: string;
  description?: string;

  // Workshop Type & Location
  workshopType: 'in_person' | 'online';
  location?: string;

  // Timezone Display
  primaryTimezone: string;
  secondaryTimezone?: string;

  // Access & Trial Settings
  accessGrantDatetime: Date;
  trialStartDatetime: Date;
  trialDurationDays: number;

  // Workshop Event Timing
  workshopStartDatetime: Date;
  workshopEndDatetime: Date;

  // Registration Settings
  registrationDeadline?: Date;
  maxEnrollment?: number;

  // Customization
  welcomeMessage?: string;
  customEmailTemplates?: EmailTemplates;
  customEmailSchedule?: EmailScheduleOverride;
  postWorkshopResources?: WorkshopResource[];

  // Post-Trial Behavior
  postTrialAction: 'upgrade_prompt' | 'auto_convert' | 'account_freeze';

  // Reminder Settings
  sendReminder: boolean;
  reminderHoursBefore: number;

  // Status
  status: 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workshop enrollment tracking
 */
export interface WorkshopEnrollment {
  id: string;
  userId: string;
  workshopId: string;

  // Enrollment tracking
  enrolledAt: Date;
  firstLoginAt?: Date;
  trialStartedAt?: Date;
  trialExpiresAt?: Date;
  convertedToPaidAt?: Date;
  worksheetCompletedAt?: Date;

  // Engagement tracking
  emailsSent: EmailLog[];
  lastActiveAt?: Date;

  // Status
  status: 'enrolled' | 'active' | 'trial_expired' | 'converted' | 'withdrawn';

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// EMAIL TEMPLATE TYPES
// =============================================================================

/**
 * Complete set of email templates for a workshop
 */
export interface EmailTemplates {
  welcome?: EmailTemplate;
  reminder?: EmailTemplate;
  week1?: EmailTemplate;
  week2?: EmailTemplate;
  week3?: EmailTemplate;
  week4?: EmailTemplate;
  wrapUp?: EmailTemplate;
}

/**
 * Individual email template configuration
 */
export interface EmailTemplate {
  subject: string;
  preheader?: string; // Preview text
  htmlBody: string; // Rich text HTML content
  plainTextBody?: string; // Plain text fallback
  fromName?: string; // Override default sender name
}

/**
 * Email schedule customization
 */
export interface EmailScheduleOverride {
  welcomeEmail?: { sendAt: 'signup' }; // Always on signup
  reminderEmail?: { hoursBefore: number }; // Default: 24 hours before workshop
  weeklyEmails?: {
    email1?: { hoursAfterWorkshopStart: number }; // Default: 2 hours after workshop ends
    email2?: { daysAfterEmail1: number }; // Default: 7 days
    email3?: { daysAfterEmail2: number }; // Default: 7 days
    email4?: { daysAfterEmail3: number }; // Default: 7 days
    wrapUp?: { daysAfterEmail4: number }; // Default: 7 days
  };
}

/**
 * Email sending log entry
 */
export interface EmailLog {
  emailType: 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4' | 'wrap_up';
  sentAt: Date;
  successful: boolean;
  errorMessage?: string;
}

// =============================================================================
// RESOURCE TYPES
// =============================================================================

/**
 * Post-workshop resource link
 */
export interface WorkshopResource {
  title: string;
  url: string;
  type?: 'recording' | 'slides' | 'worksheet' | 'other';
  description?: string;
}

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

/**
 * Workshop analytics view data
 */
export interface WorkshopAnalytics {
  id: string;
  cohortName: string;
  slug: string;
  workshopType: 'in_person' | 'online';
  status: Workshop['status'];
  workshopStartDatetime: Date;
  workshopEndDatetime: Date;
  maxEnrollment?: number;

  // Enrollment stats
  totalEnrolled: number;
  activeCount: number;
  convertedCount: number;
  withdrawnCount: number;
  trialExpiredCount: number;

  // Engagement stats
  worksheetCompletedCount: number;
  firstLoginCount: number;

  // Capacity info
  spotsRemaining?: number;
  isFull: boolean;

  // Timing info
  currentPhase: 'before_access' | 'access_granted' | 'in_progress' | 'completed';

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// DATABASE ROW TYPES (snake_case from PostgreSQL)
// =============================================================================

/**
 * Raw database row for workshops table
 */
export interface WorkshopRow {
  id: string;
  cohort_name: string;
  slug: string;
  description?: string;

  workshop_type: 'in_person' | 'online';
  location?: string;

  primary_timezone: string;
  secondary_timezone?: string;

  access_grant_datetime: Date;
  trial_start_datetime: Date;
  trial_duration_days: number;

  workshop_start_datetime: Date;
  workshop_end_datetime: Date;

  registration_deadline?: Date;
  max_enrollment?: number;

  welcome_message?: string;
  custom_email_templates?: any; // JSONB
  custom_email_schedule?: any; // JSONB
  post_workshop_resources?: any; // JSONB

  post_trial_action: 'upgrade_prompt' | 'auto_convert' | 'account_freeze';

  send_reminder: boolean;
  reminder_hours_before: number;

  status: 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';

  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Raw database row for workshop_enrollments table
 */
export interface WorkshopEnrollmentRow {
  id: string;
  user_id: string;
  workshop_id: string;

  enrolled_at: Date;
  first_login_at?: Date;
  trial_started_at?: Date;
  trial_expires_at?: Date;
  converted_to_paid_at?: Date;
  worksheet_completed_at?: Date;

  emails_sent: any; // JSONB
  last_active_at?: Date;

  status: 'enrolled' | 'active' | 'trial_expired' | 'converted' | 'withdrawn';

  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Template tag for dynamic content insertion
 */
export interface TemplateTags {
  USER_FIRST_NAME: string;
  USER_FULL_NAME: string;
  WORKSHOP_NAME: string;
  WORKSHOP_DATE: string;
  WORKSHOP_TIME: string;
  WORKSHOP_LOCATION: string;
  TRIAL_END_DATE: string;
  TRIAL_DAYS_REMAINING: string;
  CURRENT_DATE: string;
}

/**
 * Helper type for creating new workshops
 */
export type CreateWorkshopInput = Omit<Workshop, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Helper type for updating workshops
 */
export type UpdateWorkshopInput = Partial<Omit<Workshop, 'id' | 'slug' | 'createdBy' | 'createdAt' | 'updatedAt'>>;

/**
 * Helper type for creating enrollments
 */
export type CreateEnrollmentInput = Pick<WorkshopEnrollment, 'userId' | 'workshopId'>;
