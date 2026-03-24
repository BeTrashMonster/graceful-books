/**
 * Checkout API Service
 *
 * Handles Stripe checkout session creation
 */

import { api } from './api';

export interface CreateCheckoutSessionRequest {
  productId: number;
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

/**
 * Create a Stripe checkout session for a product
 */
export async function createCheckoutSession(
  productId: number
): Promise<CreateCheckoutSessionResponse> {
  return await api.post<CreateCheckoutSessionResponse>('/users/me/products', {
    productId,
  });
}
