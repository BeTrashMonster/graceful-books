/**
 * Billing API Service
 *
 * Handles all billing-related API calls to the backend.
 */

import { api } from './api';

export interface Subscription {
  id: string;
  status: 'trial' | 'active' | 'paused' | 'cancelled' | 'expired';
  productId: string;
  productName: string;
  productSlug: string;
  priceMonthly: number;
  trialEndsAt: string | null;
  trialConverted: boolean;
  activatedAt: string;
  pausedAt: string | null;
  resumedAt: string | null;
  gracePeriodEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
  isBeta: boolean;
}

export interface PaymentMethod {
  id: string;
  type: string;
  brand: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  // Bank account specific
  bankName?: string;
  accountType?: 'checking' | 'savings';
  // Link specific
  email?: string;
}

export interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  invoicePdf: string | null;
  hostedInvoiceUrl: string | null;
  created: string;
}

/**
 * Get current subscription
 */
export async function getSubscription(): Promise<Subscription | null> {
  const response = await api.get<{ data: { subscription: Subscription | null } }>(
    '/users/me/subscription'
  );
  return response.data.subscription;
}

/**
 * Pause subscription (keeps view-only access)
 */
export async function pauseSubscription(): Promise<{ message: string; paused: boolean }> {
  const response = await api.post<{ data: { message: string; paused: boolean } }>(
    '/users/me/subscription/pause'
  );
  return response.data;
}

/**
 * Resume subscription (charges immediately)
 */
export async function resumeSubscription(): Promise<{ message: string; resumed: boolean }> {
  const response = await api.post<{ data: { message: string; resumed: boolean } }>(
    '/users/me/subscription/resume'
  );
  return response.data;
}

/**
 * Get payment method on file
 */
export async function getPaymentMethod(): Promise<PaymentMethod | null> {
  const response = await api.get<{ data: { paymentMethod: PaymentMethod | null } }>(
    '/users/me/payment-methods'
  );
  return response.data.paymentMethod;
}

/**
 * Create Setup Intent for updating payment method
 */
export async function createSetupIntent(): Promise<string> {
  const response = await api.post<{ data: { clientSecret: string } }>('/users/me/setup-intent');
  return response.data.clientSecret;
}

/**
 * Update default payment method
 */
export async function updatePaymentMethod(
  paymentMethodId: string
): Promise<{ message: string; updated: boolean }> {
  const response = await api.put<{ data: { message: string; updated: boolean } }>(
    '/users/me/payment-method',
    {
      paymentMethodId,
    }
  );
  return response.data;
}

/**
 * Get invoice history
 */
export async function getInvoices(): Promise<Invoice[]> {
  const response = await api.get<{ data: { invoices: Invoice[] } }>('/users/me/invoices');
  return response.data.invoices;
}

/**
 * Delete account permanently
 */
export async function deleteAccount(data: {
  password: string;
  confirmText: string;
}): Promise<{ message: string; deleted: boolean }> {
  const response = await api.delete<{ data: { message: string; deleted: boolean } }>('/users/me', data);
  return response.data;
}
