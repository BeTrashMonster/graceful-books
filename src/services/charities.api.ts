/**
 * Charities API Service
 *
 * Handles all charity-related API calls to the backend.
 * Supports admin charity management, user selection, and analytics.
 */

import { api } from './api';
import type { CharityCategory, CharityStatus } from '../types/database.types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Charity {
  id: string;
  name: string;
  ein: string;
  shortDescription?: string;
  longDescription?: string;
  website: string;
  category: CharityCategory;
  logo?: string;
  paymentAddress?: string; // Encrypted
  status: CharityStatus;
  active: boolean;
  displayOrder: number;
  verificationNotes?: string;
  rejectionReason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharityAnalytics extends Charity {
  currentMonthPayments: number;
  currentMonthTotal: number;
  currentMonthContributors: number;
  lifetimePayments: number;
  lifetimeTotal: number;
  lifetimeContributors: number;
  activeUserSelections: number;
  totalHistoricalSelections: number;
  pendingDistributionAmount: number;
  lastDistributionDate?: string;
}

export interface CharitySelection {
  id: string;
  charityId: string;
  selectedAt: string;
  effectiveFrom: string;
  charity: {
    name: string;
    shortDescription?: string;
    website: string;
    ein: string;
    category: CharityCategory;
    logo?: string;
  };
}

export interface CharityNotification {
  id: string;
  notificationType: string;
  sentAt: string;
  readAt?: string;
  acknowledgedAt?: string;
  charityOutId: string;
  charityOutName: string;
  replacementCharityId?: string;
  replacementCharityName?: string;
  phaseOutDate: string;
  phaseInDate?: string;
  reason: string;
}

export interface CharityPhaseTransition {
  id: string;
  status: 'scheduled' | 'notified' | 'in_progress' | 'completed' | 'cancelled';
  phaseOutDate: string;
  phaseInDate?: string;
  reason: string;
  notificationSentAt?: string;
  charityOut: {
    id: string;
    name: string;
    status: CharityStatus;
  };
  replacementCharity?: {
    id: string;
    name: string;
    status: CharityStatus;
  };
  affectedUsersCount: number;
  usersAcknowledgedCount: number;
  createdBy: {
    email: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CharityDistribution {
  id: string;
  charityId: string;
  charityName: string;
  charityEin: string;
  charityPaymentAddress?: string; // Encrypted
  month: string;
  totalAmount: number;
  contributorCount: number;
  status: 'pending' | 'processing' | 'sent' | 'confirmed' | 'failed';
  paymentMethod?: 'ach' | 'check' | 'wire' | 'other';
  paymentReference?: string;
  sentAt?: string;
  confirmedAt?: string;
  notes?: string;
}

export interface ComprehensiveAnalytics {
  summary: {
    activeCharities: number;
    pendingCharities: number;
    lifetimeTotal: number;
    currentMonthTotal: number;
    totalContributors: number;
    unpaidAmount: number;
  };
  topCharities: Array<{
    id: string;
    name: string;
    activeSelections: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    totalAmount: number;
    contributorCount: number;
  }>;
}

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * Get all verified/active charities (public)
 */
export async function getCharities(): Promise<Charity[]> {
  const response = await api.get<{ data: { charities: Charity[] } }>('/charities');
  return response.data.charities;
}

// =============================================================================
// USER ENDPOINTS (Authenticated)
// =============================================================================

/**
 * Get current user's charity selection
 */
export async function getMyCharitySelection(): Promise<CharitySelection | null> {
  const response = await api.get<{ data: { selection: CharitySelection | null } }>('/charities/my-selection');
  return response.data.selection;
}

/**
 * Select or change charity
 */
export async function selectCharity(charityId: string): Promise<CharitySelection> {
  const response = await api.post<{ data: { message: string; selection: CharitySelection } }>(
    '/charities/select',
    { charityId }
  );
  return response.data.selection;
}

/**
 * Get charity phase-out notifications
 */
export async function getCharityNotifications(): Promise<CharityNotification[]> {
  const response = await api.get<{ data: { notifications: CharityNotification[] } }>('/charities/notifications');
  return response.data.notifications;
}

/**
 * Acknowledge a charity notification
 */
export async function acknowledgeNotification(notificationId: string): Promise<void> {
  await api.patch(`/charities/notifications/${notificationId}/acknowledge`);
}

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * Get all charities with analytics (admin only)
 */
export async function getAdminCharities(status?: CharityStatus): Promise<CharityAnalytics[]> {
  const queryParam = status ? `?status=${status}` : '';
  const response = await api.get<{ data: { charities: CharityAnalytics[] } }>(
    `/admin/charities${queryParam}`
  );
  return response.data.charities;
}

/**
 * Get specific charity details (admin only)
 */
export async function getAdminCharity(charityId: string): Promise<Charity> {
  const response = await api.get<{ data: { charity: Charity } }>(`/admin/charities/${charityId}`);
  return response.data.charity;
}

/**
 * Create a new charity (admin only)
 */
export interface CreateCharityRequest {
  name: string;
  ein: string;
  shortDescription?: string;
  longDescription?: string;
  website: string;
  category: CharityCategory;
  logo?: string;
  paymentAddress?: string;
  displayOrder?: number;
}

export async function createCharity(data: CreateCharityRequest): Promise<Charity> {
  const response = await api.post<{ data: { message: string; charity: Charity } }>(
    '/admin/charities',
    data
  );
  return response.data.charity;
}

/**
 * Update a charity (admin only)
 */
export interface UpdateCharityRequest {
  name?: string;
  ein?: string;
  shortDescription?: string;
  longDescription?: string;
  website?: string;
  category?: CharityCategory;
  logo?: string;
  paymentAddress?: string;
  displayOrder?: number;
}

export async function updateCharity(charityId: string, data: UpdateCharityRequest): Promise<Charity> {
  const response = await api.patch<{ data: { message: string; charity: Charity } }>(
    `/admin/charities/${charityId}`,
    data
  );
  return response.data.charity;
}

/**
 * Inactivate a charity (admin only)
 */
export async function inactivateCharity(charityId: string): Promise<void> {
  await api.delete(`/admin/charities/${charityId}`);
}

/**
 * Verify a charity (admin only)
 */
export async function verifyCharity(charityId: string, verificationNotes?: string): Promise<Charity> {
  const response = await api.post<{ data: { message: string; charity: Charity } }>(
    `/admin/charities/${charityId}/verify`,
    { verificationNotes }
  );
  return response.data.charity;
}

/**
 * Reject a charity (admin only)
 */
export async function rejectCharity(charityId: string, rejectionReason: string): Promise<Charity> {
  const response = await api.post<{ data: { message: string; charity: Charity } }>(
    `/admin/charities/${charityId}/reject`,
    { rejectionReason }
  );
  return response.data.charity;
}

// =============================================================================
// PHASE TRANSITION ENDPOINTS
// =============================================================================

/**
 * Get all phase transitions (admin only)
 */
export async function getPhaseTransitions(
  status?: 'scheduled' | 'notified' | 'in_progress' | 'completed' | 'cancelled'
): Promise<CharityPhaseTransition[]> {
  const queryParam = status ? `?status=${status}` : '';
  const response = await api.get<{ data: { transitions: CharityPhaseTransition[] } }>(
    `/admin/charity-transitions${queryParam}`
  );
  return response.data.transitions;
}

/**
 * Create a phase transition (admin only)
 */
export interface CreatePhaseTransitionRequest {
  charityId: string;
  replacementCharityId?: string;
  phaseOutDate: string;
  phaseInDate?: string;
  reason: string;
  adminNotes?: string;
}

export async function createPhaseTransition(data: CreatePhaseTransitionRequest): Promise<CharityPhaseTransition> {
  const response = await api.post<{ data: { message: string; transition: CharityPhaseTransition } }>(
    '/admin/charity-transitions',
    data
  );
  return response.data.transition;
}

/**
 * Update a phase transition (admin only)
 */
export interface UpdatePhaseTransitionRequest {
  status?: 'scheduled' | 'notified' | 'in_progress' | 'completed' | 'cancelled';
  reason?: string;
  adminNotes?: string;
}

export async function updatePhaseTransition(
  transitionId: string,
  data: UpdatePhaseTransitionRequest
): Promise<CharityPhaseTransition> {
  const response = await api.patch<{ data: { message: string; transition: CharityPhaseTransition } }>(
    `/admin/charity-transitions/${transitionId}`,
    data
  );
  return response.data.transition;
}

/**
 * Send notifications to affected users (admin only)
 */
export async function notifyPhaseTransitionUsers(transitionId: string): Promise<{ affectedUsersCount: number }> {
  const response = await api.post<{ data: { message: string; affectedUsersCount: number } }>(
    `/admin/charity-transitions/${transitionId}/notify`
  );
  return { affectedUsersCount: response.data.affectedUsersCount };
}

// =============================================================================
// DISTRIBUTION ENDPOINTS
// =============================================================================

/**
 * Get charity distributions (admin only)
 */
export async function getDistributions(
  month?: string,
  status?: 'pending' | 'processing' | 'sent' | 'confirmed' | 'failed'
): Promise<CharityDistribution[]> {
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  if (status) params.append('status', status);
  const queryString = params.toString();

  const response = await api.get<{ data: { distributions: CharityDistribution[] } }>(
    `/admin/charity-distributions${queryString ? `?${queryString}` : ''}`
  );
  return response.data.distributions;
}

/**
 * Mark a distribution as paid (admin only)
 */
export interface MarkDistributionPaidRequest {
  paymentMethod: 'ach' | 'check' | 'wire' | 'other';
  paymentReference?: string;
  notes?: string;
}

export async function markDistributionPaid(
  distributionId: string,
  data: MarkDistributionPaidRequest
): Promise<CharityDistribution> {
  const response = await api.post<{ data: { message: string; distribution: CharityDistribution } }>(
    `/admin/charity-distributions/${distributionId}/mark-paid`,
    data
  );
  return response.data.distribution;
}

// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================

/**
 * Get comprehensive charity analytics (admin only)
 */
export async function getComprehensiveAnalytics(): Promise<ComprehensiveAnalytics> {
  const response = await api.get<{ data: ComprehensiveAnalytics }>('/admin/charity-analytics');
  return response.data;
}
