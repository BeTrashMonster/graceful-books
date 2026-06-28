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
  status: 'enrolled' | 'active' | 'trial_active' | 'trial_expired' | 'converted' | 'cancelled';
  accessGranted: boolean;
  accessGrantedAt?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
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

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get all workshops (admin only)
 */
export async function getWorkshops(): Promise<Workshop[]> {
  const response = await api.get<{ data: { workshops: Workshop[] } }>('/admin/workshops');
  return response.data.workshops;
}

/**
 * Get a single workshop by ID
 */
export async function getWorkshop(id: string): Promise<Workshop> {
  const response = await api.get<{ data: { workshop: Workshop } }>(`/admin/workshops/${id}`);
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
  const url = `/admin/workshops/${workshopId}/enrollments${queryString ? `?${queryString}` : ''}`;

  return api.get<WorkshopEnrollment[]>(url);
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
  const url = `/admin/workshops/${workshopId}/analytics${queryString ? `?${queryString}` : ''}`;

  return api.get<WorkshopAnalyticsData>(url);
}

/**
 * Grant access to a workshop enrollment
 */
export async function grantEnrollmentAccess(enrollmentId: string): Promise<WorkshopEnrollment> {
  return api.put<WorkshopEnrollment>(`/admin/enrollments/${enrollmentId}/grant-access`, {});
}

/**
 * Start trial for a workshop enrollment
 */
export async function startEnrollmentTrial(enrollmentId: string): Promise<WorkshopEnrollment> {
  return api.put<WorkshopEnrollment>(`/admin/enrollments/${enrollmentId}/start-trial`, {});
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
  return api.get<WorkshopEnrollment | null>('/api/workshops/my-enrollment');
}

/**
 * Save worksheet progress for current user (requires auth)
 */
export async function saveWorksheetProgress(data: {
  productId?: string;
  ingredients?: Array<{ name: string; quantity: number; cost: number }>;
  packaging?: Array<{ name: string; cost: number }>;
  laborTime?: number;
  distributionCost?: number;
  totalCost?: number;
}): Promise<{ success: boolean }> {
  return api.put('/api/workshops/my-enrollment/worksheet', data);
}

/**
 * Mark worksheet as completed (requires auth)
 */
export async function completeWorksheet(): Promise<{ success: boolean }> {
  return api.post('/api/workshops/my-enrollment/worksheet/complete', {});
}
