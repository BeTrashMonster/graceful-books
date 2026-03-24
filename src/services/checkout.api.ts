/**
 * Checkout API Service
 *
 * Handles Stripe checkout session creation
 */

import { api } from './api';

export interface CreateCheckoutSessionRequest {
  productId: string; // UUID
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

/**
 * Create a Stripe checkout session for a product
 */
export async function createCheckoutSession(
  productId: string // UUID
): Promise<CreateCheckoutSessionResponse> {
  const response = await api.post<{ data: CreateCheckoutSessionResponse }>('/users/me/products', {
    productId,
  });
  return response.data;
}
