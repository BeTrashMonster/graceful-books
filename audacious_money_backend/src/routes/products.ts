/**
 * Products routes
 *
 * Public endpoints for fetching available products and pricing
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { success, notFound, ErrorCodes, ErrorMessages } from '../utils/responses.js';

const products = new Hono<HonoEnv>();

/**
 * GET /products
 *
 * Get all active products
 */
products.get('/', async (c) => {
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT
         id,
         name,
         slug,
         description,
         price_monthly,
         price_annual,
         stripe_price_id as stripe_price_id_monthly,
         stripe_price_id_annual,
         active,
         display_order as sort_order
       FROM products
       WHERE active = true
       ORDER BY display_order ASC`
    );

    return success(c, result.rows);
  } catch (error) {
    console.error('[Products] Error fetching products:', error);
    return success(c, []); // Return empty array on error
  }
});

/**
 * GET /products/:slug
 *
 * Get a specific product by slug
 */
products.get('/:slug', async (c) => {
  const { slug } = c.req.param();
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT
         id,
         name,
         slug,
         description,
         price_monthly,
         price_annual,
         stripe_price_id as stripe_price_id_monthly,
         stripe_price_id_annual,
         active,
         display_order as sort_order
       FROM products
       WHERE slug = $1 AND active = true`,
      [slug]
    );

    if (result.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
    }

    return success(c, result.rows[0]);
  } catch (error) {
    console.error('[Products] Error fetching product:', error);
    return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
  }
});

export default products;
