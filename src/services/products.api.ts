/**
 * Products API Service
 *
 * Handles fetching available products and pricing
 */

import { api } from './api';

export interface Product {
  id: string; // UUID from database
  name: string;
  slug: string;
  description: string;
  price_usd: number;
  billing_cycle: 'monthly' | 'per_product';
  stripe_price_id: string | null;
  active: boolean;
  sort_order: number;
}

/**
 * Get all active products
 */
export async function getProducts(): Promise<Product[]> {
  const response = await api.get<{ data: Product[] }>('/products');
  return response.data;
}

/**
 * Get a specific product by slug
 */
export async function getProductBySlug(slug: string): Promise<Product> {
  const response = await api.get<{ data: Product }>(`/products/${slug}`);
  return response.data;
}
