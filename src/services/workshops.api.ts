/**
 * Workshops API Service
 *
 * Handles all workshop-related API calls to the backend.
 * Supports admin workshop management, enrollments, and analytics.
 */

import { api } from './api';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Workshop {
  id: string;
  cohortName: string;
  workshopName?: string;
  slug: string;
  description?: string;
  workshopType: 'in_person' | 'online';
  location?: string;
  primaryTimezone: string;
  secondaryTimezone?: string;
  accessGrantDatetime?: string;
  trialStartDatetime?: string;
  trialDurationDays?: number;
  workshopStartDatetime: string;
  workshopEndDatetime: string;
  registrationDeadline?: string;
  maxEnrollment?: number;
  stripePriceId?: string;
  welcomeMessage?: string;
  customEmailTemplates?: Record<string, any>;
  customEmailSchedule?: Record<string, any>;
  postWorkshopResources?: Array<{ title: string; url: string }>;
  postTrialAction?: 'upgrade_prompt' | 'auto_convert' | 'account_freeze';
  sendReminder?: boolean;
  reminderHoursBefore?: number;
  status: 'draft' | 'open_registration' | 'registration_closed' | 'in_progress' | 'completed' | 'archived';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkshopEnrollment {
  id: string;
  userId: string;
  workshopId: string;
  enrolledAt: string;
  firstLoginAt?: string;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  convertedToPaidAt?: string;
  worksheetCompletedAt?: string;
  emailsSent?: Array<{ emailType: string; sentAt: string }>;
  lastActiveAt?: string;
  status?: 'enrolled' | 'active' | 'trial_active' | 'trial_expired' | 'converted' | 'cancelled';
  accessGranted: boolean;
  accessGrantedAt?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  workshop?: Workshop;
}

export interface WorkshopAnalyticsData {
  workshopId: string;
  totalEnrollments: number;
  activeParticipants: number;
  trialConversions: number;
  trialConversionRate: number;
  worksheetCompletionRate: number;
  averageTimeToConversion?: number;
  statusBreakdown: {
    enrolled: number;
    active: number;
    trial_active: number;
    trial_expired: number;
    converted: number;
    cancelled: number;
  };
  enrollmentsOverTime: Array<{
    date: string;
    count: number;
  }>;
  emailEngagement?: {
    welcomeEmailOpenRate?: number;
    reminderEmailOpenRate?: number;
    weeklyEmailOpenRates?: Record<string, number>;
  };
}

export interface EmailTrackingEvent {
  message_id: string;
  recipient_email: string;
  subject: string;
  email_type: string;
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam_complaint';
  event_timestamp: string;
  event_metadata?: {
    clickedUrl?: string;
    bounceType?: string;
    description?: string;
  };
}

export interface EmailTrackingSummary {
  email_type: string;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
}

export interface EmailTrackingData {
  events: EmailTrackingEvent[];
  summary: EmailTrackingSummary[];
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get all workshops (admin only)
 */
export async function getWorkshops(): Promise<Workshop[]> {
  const response = await api.get<{ data: { workshops: Workshop[] } }>('/api/workshops');
  return response.data.workshops;
}

/**
 * Get a single workshop by ID
 */
export async function getWorkshop(id: string): Promise<Workshop> {
  const response = await api.get<{ data: { workshop: Workshop } }>(`/api/workshops/${id}`);
  return response.data.workshop;
}

/**
 * Get all enrollments for a workshop
 */
export async function getWorkshopEnrollments(
  workshopId: string,
  filters?: {
    status?: string;
    search?: string;
  }
): Promise<WorkshopEnrollment[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  const url = `/api/workshops/${workshopId}/enrollments${queryString ? `?${queryString}` : ''}`;

  const response = await api.get<{ data: { enrollments: WorkshopEnrollment[] } }>(url);
  return response.data.enrollments;
}

/**
 * Get analytics for a workshop
 */
export async function getWorkshopAnalytics(
  workshopId: string,
  dateRange?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<WorkshopAnalyticsData> {
  const params = new URLSearchParams();
  if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
  if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

  const queryString = params.toString();
  const url = `/api/workshops/${workshopId}/analytics${queryString ? `?${queryString}` : ''}`;

  return api.get<WorkshopAnalyticsData>(url);
}

/**
 * Grant access to a workshop enrollment
 */
export async function grantEnrollmentAccess(enrollmentId: string): Promise<WorkshopEnrollment> {
  const response = await api.put<{ data: { enrollment: WorkshopEnrollment } }>(`/api/enrollments/${enrollmentId}/grant-access`, {});
  return response.data.enrollment;
}

/**
 * Start trial for a workshop enrollment
 */
export async function startEnrollmentTrial(enrollmentId: string): Promise<WorkshopEnrollment> {
  const response = await api.put<{ data: { enrollment: WorkshopEnrollment } }>(`/api/enrollments/${enrollmentId}/start-trial`, {});
  return response.data.enrollment;
}

/**
 * Export enrollments to CSV
 */
export async function exportEnrollmentsCSV(
  workshopId: string,
  enrollments: WorkshopEnrollment[]
): Promise<void> {
  const headers = [
    'Name',
    'Email',
    'Enrollment Date',
    'Status',
    'Access Granted',
    'Trial Start',
    'Trial Expires',
    'Converted',
    'Worksheet Completed',
  ];

  const rows = enrollments.map(enrollment => [
    enrollment.user?.name || 'N/A',
    enrollment.user?.email || 'N/A',
    new Date(enrollment.enrolledAt).toLocaleDateString(),
    enrollment.status,
    enrollment.accessGrantedAt ? new Date(enrollment.accessGrantedAt).toLocaleDateString() : 'No',
    enrollment.trialStartedAt ? new Date(enrollment.trialStartedAt).toLocaleDateString() : 'N/A',
    enrollment.trialExpiresAt ? new Date(enrollment.trialExpiresAt).toLocaleDateString() : 'N/A',
    enrollment.convertedToPaidAt ? new Date(enrollment.convertedToPaidAt).toLocaleDateString() : 'N/A',
    enrollment.worksheetCompletedAt ? new Date(enrollment.worksheetCompletedAt).toLocaleDateString() : 'No',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `workshop-enrollments-${workshopId}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export analytics to CSV
 */
export async function exportAnalyticsCSV(
  workshopId: string,
  analytics: WorkshopAnalyticsData
): Promise<void> {
  const rows = [
    ['Metric', 'Value'],
    ['Total Enrollments', analytics.totalEnrollments.toString()],
    ['Active Participants', analytics.activeParticipants.toString()],
    ['Trial Conversions', analytics.trialConversions.toString()],
    ['Conversion Rate', `${analytics.trialConversionRate.toFixed(2)}%`],
    ['Worksheet Completion Rate', `${analytics.worksheetCompletionRate.toFixed(2)}%`],
    [''],
    ['Status Breakdown', ''],
    ['Enrolled', analytics.statusBreakdown.enrolled.toString()],
    ['Active', analytics.statusBreakdown.active.toString()],
    ['Trial Active', analytics.statusBreakdown.trial_active.toString()],
    ['Trial Expired', analytics.statusBreakdown.trial_expired.toString()],
    ['Converted', analytics.statusBreakdown.converted.toString()],
    ['Cancelled', analytics.statusBreakdown.cancelled.toString()],
  ];

  const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `workshop-analytics-${workshopId}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get email tracking data for a workshop enrollment
 */
export async function getEnrollmentEmailTracking(
  workshopId: string,
  userId: string
): Promise<EmailTrackingData> {
  const url = `/api/workshops/${workshopId}/enrollments/${userId}/email-tracking`;
  const response = await api.get<{ data: EmailTrackingData }>(url);
  return response.data;
}

// =============================================================================
// PUBLIC WORKSHOP ENDPOINTS (for signup flow)
// =============================================================================

/**
 * Get workshop details by slug (public endpoint)
 */
export async function getWorkshopBySlug(slug: string): Promise<Workshop> {
  const response = await api.get<{ data: { workshop: Workshop } }>(`/api/workshops/slug/${slug}`);
  return response.data.workshop;
}

/**
 * Enroll in a workshop (public signup endpoint - creates account + enrolls)
 */
export async function enrollInWorkshop(
  workshopId: string,
  enrollmentData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    charityId?: string;
  }
): Promise<{
  data: {
    success: boolean;
    enrollment: WorkshopEnrollment;
    user: {
      id: string;
      email: string;
    };
    token: string;
  };
}> {
  return api.post(`/api/workshops/${workshopId}/signup`, enrollmentData);
}

/**
 * Get current user's workshop enrollment (requires auth)
 */
export async function getMyWorkshopEnrollment(): Promise<WorkshopEnrollment | null> {
  const response = await api.get<{ data: { enrollment: WorkshopEnrollment | null } }>('/api/workshops/my-enrollment');
  return response.data.enrollment;
}

/**
 * Mark worksheet as completed (requires auth)
 */
export async function completeWorksheet(): Promise<{ success: boolean }> {
  return api.post('/api/workshops/my-enrollment/worksheet/complete', {});
}

// =============================================================================
// ADMIN EMAIL SENDING
// =============================================================================

export type EmailType = 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4' | 'wrapUp' | 'custom';

export interface SendEmailRequest {
  enrollmentIds: string[];
  emailType: EmailType;
  customContent?: {
    subject: string;
    htmlBody: string;
    plainTextBody?: string;
    fromName?: string;
  };
}

export interface SendEmailResult {
  email: string;
  success: boolean;
  error?: string;
}

export interface SendEmailResponse {
  message: string;
  results: SendEmailResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

/**
 * Send emails to selected workshop enrollees (admin only)
 * Can send predefined email types (using custom templates if configured)
 * or completely custom one-off emails
 */
export async function sendWorkshopEmails(
  workshopId: string,
  request: SendEmailRequest
): Promise<SendEmailResponse> {
  const response = await api.post<{ data: SendEmailResponse }>(
    `/api/workshops/${workshopId}/send-email`,
    request
  );
  return response.data;
}
