/**
 * Affiliate service for Audacious Money platform
 *
 * Handles affiliate tracking and conversion management
 */

import type { Pool } from 'pg';

/**
 * Track affiliate signup (referral)
 *
 * This function records when a user signs up via an affiliate link.
 * The conversion tracking (when they actually subscribe and pay) happens separately.
 *
 * @param db - Database pool
 * @param userId - User ID who signed up
 * @param affiliateCode - Affiliate code used for signup
 * @returns Promise<boolean> - True if tracking was successful, false otherwise
 */
export async function trackAffiliateSignup(
  db: Pool,
  userId: string,
  affiliateCode: string
): Promise<boolean> {
  try {
    // First, verify the affiliate code exists and is active
    const affiliateResult = await db.query(
      'SELECT id, active FROM affiliates WHERE code = $1',
      [affiliateCode.toUpperCase()]
    );

    if (affiliateResult.rowCount === 0) {
      console.warn(`[Affiliate] Invalid affiliate code: ${affiliateCode}`);
      return false;
    }

    const affiliate = affiliateResult.rows[0];

    if (!affiliate.active) {
      console.warn(`[Affiliate] Inactive affiliate code: ${affiliateCode}`);
      return false;
    }

    // Record the affiliate conversion (without payment details yet)
    // This creates a record that will be updated when the user subscribes
    await db.query(
      `
      INSERT INTO affiliate_conversions (affiliate_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [affiliate.id, userId]
    );

    console.log(
      `[Affiliate] Tracked signup for user ${userId} via affiliate ${affiliateCode}`
    );

    return true;
  } catch (error) {
    console.error('[Affiliate] Error tracking affiliate signup:', error);
    // Don't throw - affiliate tracking failures shouldn't break signup
    return false;
  }
}

/**
 * Update affiliate conversion with first payment details
 *
 * Called when a user makes their first payment after signing up via an affiliate link
 *
 * @param db - Database pool
 * @param userId - User ID who made the payment
 * @param productId - Product ID they subscribed to
 * @param paymentAmount - Amount of first payment
 * @returns Promise<void>
 */
export async function updateAffiliateConversion(
  db: Pool,
  userId: string,
  productId: string,
  paymentAmount: number
): Promise<void> {
  try {
    // Check if there's an affiliate conversion for this user
    const conversionResult = await db.query(
      `
      SELECT ac.id, a.commission_type, a.commission_value
      FROM affiliate_conversions ac
      JOIN affiliates a ON a.id = ac.affiliate_id
      WHERE ac.user_id = $1 AND ac.converted_at IS NULL
      `,
      [userId]
    );

    if (conversionResult.rowCount === 0) {
      // No affiliate conversion to update
      return;
    }

    const conversion = conversionResult.rows[0];

    // Calculate commission based on type
    let commissionEarned: number;
    if (conversion.commission_type === 'percentage') {
      commissionEarned = paymentAmount * (conversion.commission_value / 100);
    } else {
      // Fixed commission
      commissionEarned = conversion.commission_value;
    }

    // Update the conversion with payment details
    await db.query(
      `
      UPDATE affiliate_conversions
      SET
        product_id = $1,
        converted_at = NOW(),
        first_payment_amount = $2,
        commission_earned = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [productId, paymentAmount, commissionEarned, conversion.id]
    );

    console.log(
      `[Affiliate] Updated conversion for user ${userId}, commission: $${commissionEarned}`
    );
  } catch (error) {
    console.error('[Affiliate] Error updating affiliate conversion:', error);
    // Don't throw - affiliate tracking failures shouldn't break payment processing
  }
}

/**
 * Get affiliate by code
 *
 * @param db - Database pool
 * @param code - Affiliate code
 * @returns Promise<Affiliate | null>
 */
export async function getAffiliateByCode(
  db: Pool,
  code: string
): Promise<{ id: string; code: string; active: boolean } | null> {
  try {
    const result = await db.query(
      'SELECT id, code, active FROM affiliates WHERE code = $1',
      [code.toUpperCase()]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('[Affiliate] Error getting affiliate by code:', error);
    return null;
  }
}

/**
 * Get affiliate conversions (for admin dashboard)
 *
 * @param db - Database pool
 * @param affiliateId - Affiliate ID
 * @returns Promise<Array> - List of conversions
 */
export async function getAffiliateConversions(
  db: Pool,
  affiliateId: string
): Promise<any[]> {
  try {
    const result = await db.query(
      `
      SELECT
        ac.id,
        ac.user_id,
        ac.product_id,
        ac.converted_at,
        ac.first_payment_amount,
        ac.commission_earned,
        ac.commission_paid,
        ac.created_at,
        u.email as user_email,
        p.name as product_name
      FROM affiliate_conversions ac
      JOIN users u ON u.id = ac.user_id
      LEFT JOIN products p ON p.id = ac.product_id
      WHERE ac.affiliate_id = $1
      ORDER BY ac.created_at DESC
      `,
      [affiliateId]
    );

    return result.rows;
  } catch (error) {
    console.error('[Affiliate] Error getting affiliate conversions:', error);
    return [];
  }
}
