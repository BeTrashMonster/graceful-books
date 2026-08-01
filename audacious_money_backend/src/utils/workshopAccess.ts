/**
 * Workshop access control utilities
 *
 * Helper functions for determining workshop access, trial status, and enrollment eligibility
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import type { Workshop, WorkshopEnrollment } from '../types/workshop.types.js';

/**
 * Default timezone - PST (Pacific Standard Time)
 * Used when workshop doesn't specify a timezone
 */
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// =============================================================================
// ACCESS CONTROL FUNCTIONS
// =============================================================================

/**
 * Determine if workshop access should be granted to user
 *
 * @param enrollment - User's workshop enrollment record
 * @param workshop - Workshop configuration
 * @returns true if access should be granted, false otherwise
 */
export function hasWorkshopAccess(enrollment: WorkshopEnrollment, workshop: Workshop): boolean {
  const now = new Date();
  const accessGrantTime = new Date(workshop.accessGrantDatetime);

  // Access granted if current time is past the access grant time
  return now >= accessGrantTime;
}

/**
 * Determine if user's trial has started
 *
 * @param enrollment - User's workshop enrollment record
 * @param workshop - Workshop configuration
 * @returns true if trial has started, false otherwise
 */
export function hasTrialStarted(enrollment: WorkshopEnrollment, workshop: Workshop): boolean {
  const now = new Date();
  const trialStartTime = new Date(workshop.trialStartDatetime);

  return now >= trialStartTime;
}

/**
 * Calculate trial expiration date for a user
 *
 * IMPORTANT: This calculation honors the workshop's timezone.
 * If workshop is PST and trial is 30 days, it expires at end of day 30 in PST.
 *
 * @param workshop - Workshop configuration (includes primaryTimezone)
 * @param trialStartedAt - When the user's trial started
 * @returns Date when trial expires (end of the last trial day in workshop timezone)
 */
export function calculateTrialExpiration(workshop: Workshop, trialStartedAt: Date): Date {
  const timezone = workshop.primaryTimezone || DEFAULT_TIMEZONE;

  // Convert trial start to workshop timezone
  const trialStartInTz = toZonedTime(trialStartedAt, timezone);

  // Add trial duration days
  const trialEndInTz = addDays(trialStartInTz, workshop.trialDurationDays);

  // Trial expires at END of the last day (11:59:59 PM in workshop timezone)
  const endOfTrialDay = endOfDay(trialEndInTz);

  // Convert back to a proper Date object that represents this moment
  const expiration = fromZonedTime(endOfTrialDay, timezone);

  console.log(`[WorkshopAccess] Trial calculation:`, {
    timezone,
    trialStartedAt: trialStartedAt.toISOString(),
    trialDurationDays: workshop.trialDurationDays,
    trialEndInTz: trialEndInTz.toISOString(),
    expiration: expiration.toISOString(),
  });

  return expiration;
}

/**
 * Check if user's trial has expired
 *
 * @param enrollment - User's workshop enrollment record
 * @param timezone - Optional timezone for logging (defaults to PST)
 * @returns true if trial has expired, false otherwise
 */
export function isTrialExpired(enrollment: WorkshopEnrollment, timezone?: string): boolean {
  if (!enrollment.trialExpiresAt) return false;

  const tz = timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const expiresAt = new Date(enrollment.trialExpiresAt);
  const expired = now > expiresAt;

  // Log in workshop timezone for clarity
  const nowInTz = toZonedTime(now, tz);
  const expiresInTz = toZonedTime(expiresAt, tz);

  console.log(`[WorkshopAccess] Trial expiration check:`, {
    timezone: tz,
    nowInTimezone: nowInTz.toISOString(),
    expiresInTimezone: expiresInTz.toISOString(),
    expired,
  });

  return expired;
}

/**
 * Calculate days remaining in trial
 *
 * @param enrollment - User's workshop enrollment record
 * @returns Number of days remaining, or null if trial hasn't started or has expired
 */
export function getTrialDaysRemaining(enrollment: WorkshopEnrollment): number | null {
  if (!enrollment.trialExpiresAt) return null;

  const now = new Date();
  const expiresAt = new Date(enrollment.trialExpiresAt);

  if (now > expiresAt) return 0;

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);

  return daysRemaining;
}

// =============================================================================
// WORKSHOP ENROLLMENT FUNCTIONS
// =============================================================================

/**
 * Determine if workshop is accepting enrollments
 *
 * @param workshop - Workshop configuration
 * @returns true if accepting enrollments, false otherwise
 */
export function isWorkshopAcceptingEnrollments(workshop: Workshop): boolean {
  // Check status
  if (workshop.status !== 'open_registration') {
    return false;
  }

  // Check registration deadline - SIMPLE UTC comparison
  // The deadline is stored as UTC ISO string, just compare directly
  if (workshop.registrationDeadline) {
    try {
      const now = new Date();
      const deadline = new Date(workshop.registrationDeadline);

      if (now > deadline) {
        return false;
      }
    } catch (err) {
      console.error('[Workshop Access] Error parsing deadline:', err);
      // If we can't parse the deadline, allow enrollment (fail open)
      return true;
    }
  }

  return true;
}

/**
 * Check if workshop has reached max enrollment
 *
 * @param currentEnrollmentCount - Current number of enrollments
 * @param workshop - Workshop configuration
 * @returns true if workshop is full, false otherwise
 */
export function isWorkshopFull(currentEnrollmentCount: number, workshop: Workshop): boolean {
  if (!workshop.maxEnrollment) return false;

  return currentEnrollmentCount >= workshop.maxEnrollment;
}

/**
 * Check if user can enroll in workshop
 *
 * @param workshop - Workshop configuration
 * @param currentEnrollmentCount - Current number of enrollments
 * @param isAlreadyEnrolled - Whether user is already enrolled
 * @returns Object with canEnroll boolean and reason string
 */
export function canUserEnrollInWorkshop(
  workshop: Workshop,
  currentEnrollmentCount: number,
  isAlreadyEnrolled: boolean
): { canEnroll: boolean; reason?: string } {
  // Already enrolled
  if (isAlreadyEnrolled) {
    return { canEnroll: false, reason: 'You are already enrolled in this workshop' };
  }

  // Not accepting enrollments
  if (!isWorkshopAcceptingEnrollments(workshop)) {
    return { canEnroll: false, reason: 'This workshop is not currently accepting enrollments' };
  }

  // Workshop is full
  if (isWorkshopFull(currentEnrollmentCount, workshop)) {
    return { canEnroll: false, reason: 'This workshop has reached maximum capacity' };
  }

  return { canEnroll: true };
}

// =============================================================================
// EMAIL SCHEDULING FUNCTIONS
// =============================================================================

/**
 * Get default email schedule for workshop
 *
 * @param workshop - Workshop configuration
 * @param enrolledAt - When user enrolled (for welcome email)
 * @returns Object with scheduled dates for each email type
 */
export function getEmailSchedule(
  workshop: Workshop,
  enrolledAt: Date
): {
  welcome: Date;
  reminder: Date | null;
  week1: Date;
  week2: Date;
  week3: Date;
  week4: Date;
  wrapUp: Date;
} {
  const workshopStart = new Date(workshop.workshopStartDatetime);
  const workshopEnd = new Date(workshop.workshopEndDatetime);

  // Apply custom overrides or use defaults
  const customSchedule = workshop.customEmailSchedule;

  // Welcome email: Immediately on enrollment
  const welcome = new Date(enrolledAt);

  // Reminder email: Hours before workshop starts (if enabled)
  let reminder: Date | null = null;
  if (workshop.sendReminder) {
    const hoursBefore = customSchedule?.reminderEmail?.hoursBefore ?? workshop.reminderHoursBefore;
    reminder = new Date(workshopStart);
    reminder.setHours(reminder.getHours() - hoursBefore);
  }

  // Week 1: Hours after workshop ends (default: 2 hours)
  const week1Hours = customSchedule?.weeklyEmails?.email1?.hoursAfterWorkshopStart ?? 2;
  const week1 = new Date(workshopEnd);
  week1.setHours(week1.getHours() + week1Hours);

  // Week 2: Days after Week 1 email (default: 7 days)
  const week2Days = customSchedule?.weeklyEmails?.email2?.daysAfterEmail1 ?? 7;
  const week2 = new Date(week1);
  week2.setDate(week2.getDate() + week2Days);

  // Week 3: Days after Week 2 email (default: 7 days)
  const week3Days = customSchedule?.weeklyEmails?.email3?.daysAfterEmail2 ?? 7;
  const week3 = new Date(week2);
  week3.setDate(week3.getDate() + week3Days);

  // Week 4: Days after Week 3 email (default: 7 days)
  const week4Days = customSchedule?.weeklyEmails?.email4?.daysAfterEmail3 ?? 7;
  const week4 = new Date(week3);
  week4.setDate(week4.getDate() + week4Days);

  // Wrap-up: Days after Week 4 email (default: 7 days)
  const wrapUpDays = customSchedule?.weeklyEmails?.wrapUp?.daysAfterEmail4 ?? 7;
  const wrapUp = new Date(week4);
  wrapUp.setDate(wrapUp.getDate() + wrapUpDays);

  return {
    welcome,
    reminder,
    week1,
    week2,
    week3,
    week4,
    wrapUp,
  };
}

/**
 * Check if email should be sent based on schedule
 *
 * @param emailType - Type of email to check
 * @param schedule - Email schedule object
 * @param emailsSent - Array of already sent emails
 * @returns true if email should be sent now, false otherwise
 */
export function shouldSendEmail(
  emailType: 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4' | 'wrap_up',
  schedule: ReturnType<typeof getEmailSchedule>,
  emailsSent: WorkshopEnrollment['emailsSent']
): boolean {
  // Check if email was already sent
  const alreadySent = emailsSent.some((log) => log.emailType === emailType && log.successful);
  if (alreadySent) return false;

  // Get scheduled time for this email type
  const scheduledTime = schedule[emailType === 'wrap_up' ? 'wrapUp' : emailType];
  if (!scheduledTime) return false;

  // Check if scheduled time has passed
  const now = new Date();
  return now >= scheduledTime;
}

// =============================================================================
// WORKSHOP PHASE FUNCTIONS
// =============================================================================

/**
 * Get current phase of workshop
 *
 * @param workshop - Workshop configuration
 * @returns Current phase of the workshop
 */
export function getWorkshopPhase(
  workshop: Workshop
): 'before_access' | 'access_granted' | 'in_progress' | 'completed' {
  const now = new Date();
  const accessGrantTime = new Date(workshop.accessGrantDatetime);
  const workshopStart = new Date(workshop.workshopStartDatetime);
  const workshopEnd = new Date(workshop.workshopEndDatetime);

  if (now < accessGrantTime) {
    return 'before_access';
  } else if (now >= accessGrantTime && now < workshopStart) {
    return 'access_granted';
  } else if (now >= workshopStart && now < workshopEnd) {
    return 'in_progress';
  } else {
    return 'completed';
  }
}

/**
 * Get time until workshop access is granted
 *
 * @param workshop - Workshop configuration
 * @returns Object with days, hours, minutes, and seconds until access
 */
export function getTimeUntilAccess(workshop: Workshop): {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  const now = new Date();
  const accessGrantTime = new Date(workshop.accessGrantDatetime);

  if (now >= accessGrantTime) return null;

  const totalSeconds = Math.floor((accessGrantTime.getTime() - now.getTime()) / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalSeconds,
    days,
    hours,
    minutes,
    seconds,
  };
}

/**
 * Get time until workshop starts
 *
 * @param workshop - Workshop configuration
 * @returns Object with days, hours, minutes, and seconds until workshop
 */
export function getTimeUntilWorkshop(workshop: Workshop): {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  const now = new Date();
  const workshopStart = new Date(workshop.workshopStartDatetime);

  if (now >= workshopStart) return null;

  const totalSeconds = Math.floor((workshopStart.getTime() - now.getTime()) / 1000);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalSeconds,
    days,
    hours,
    minutes,
    seconds,
  };
}
