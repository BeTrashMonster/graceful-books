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
  const response = await api.get<{ data: any[] }>('/products');
  // Convert price_usd from string to number (PostgreSQL returns DECIMAL as string)
  return response.data.map(product => ({
    ...product,
    price_usd: typeof product.price_usd === 'string' ? parseFloat(product.price_usd) : product.price_usd,
  }));
}

/**
 * Get a specific product by slug
 */
export async function getProductBySlug(slug: string): Promise<Product> {
  const response = await api.get<{ data: any }>(`/products/${slug}`);
  // Convert price_usd from string to number (PostgreSQL returns DECIMAL as string)
  return {
    ...response.data,
    price_usd: typeof response.data.price_usd === 'string' ? parseFloat(response.data.price_usd) : response.data.price_usd,
  };
}
