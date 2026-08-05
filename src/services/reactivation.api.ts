/**
 * Reactivation API Service
 *
 * PURPOSE:
 * Handles API calls for subscription reactivation, specifically
 * creating Stripe Checkout sessions for frozen accounts.
 *
 * FLOW:
 * 1. User confirms charity selection in CharityConfirmation
 * 2. ReactivationFlow calls createReactivationCheckout()
 * 3. Backend creates Stripe Checkout session
 * 4. Frontend redirects to Stripe
 * 5. Stripe redirects back to success/cancel URL
 *
 * @module services/reactivation.api
 */

import { api } from './api';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateReactivationCheckoutRequest {
  /** Selected charity ID for the $5/month donation */
  charityId: string;
  /** Workshop ID if reactivating from workshop enrollment */
  workshopId?: string;
}

export interface CreateReactivationCheckoutResponse {
  /** Stripe Checkout session URL to redirect to */
  url: string;
  /** Session ID for reference */
  sessionId: string;
}

// =============================================================================
// API CALLS
// =============================================================================

/**
 * Creates a Stripe Checkout session for subscription reactivation.
 *
 * The backend will:
 * 1. Verify the user's frozen state
 * 2. Create a Checkout session with appropriate pricing
 * 3. Store the charity selection for post-payment processing
 * 4. Return the Checkout URL
 *
 * @param request - Charity ID and optional workshop ID
 * @returns Checkout URL and session ID
 * @throws Error if session creation fails
 */
export async function createReactivationCheckout(
  request: CreateReactivationCheckoutRequest
): Promise<CreateReactivationCheckoutResponse> {
  const response = await api.post<{ data: CreateReactivationCheckoutResponse }>(
    '/api/subscriptions/reactivate',
    {
      charityId: request.charityId,
      workshopId: request.workshopId,
    }
  );

  return response.data;
}

/**
 * Verifies a successful reactivation after Stripe redirect.
 *
 * Called on the success page to:
 * 1. Verify the session was completed
 * 2. Update the user's subscription status
 * 3. Process the charity selection
 *
 * @param sessionId - Stripe Checkout session ID from URL params
 * @returns Confirmation of successful reactivation
 */
export async function verifyReactivation(
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  const response = await api.post<{ data: { success: boolean; message: string } }>(
    '/api/subscriptions/verify-reactivation',
    { sessionId }
  );

  return response.data;
}
