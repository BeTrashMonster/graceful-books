/**
 * Lifetime Access Codes Service
 *
 * Handles creation, validation, and redemption of lifetime access codes.
 * These codes allow users to gain product access without payment.
 */

import { Pool } from 'pg';
import { grantProductAccess } from './adminDiagnostics.service.js';
import { sendWelcomeEmail } from './email.service.js';
import { generateUserToken } from '../utils/auth.js';
import { hashPassword } from '../utils/password.js';

// =============================================================================
// TYPES
// =============================================================================

export interface LifetimeCode {
  id: string;
  code: string;
  name: string;
  maxRedemptions: number | null;
  redemptionsUsed: number;
  expiresAt: string | null;
  notes: string | null;
  isActive: boolean;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
  products?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export interface LifetimeCodeRedemption {
  id: string;
  lifetimeCodeId: string;
  userId: string;
  redeemedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  user?: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateCodeInput {
  name: string;
  productIds: string[];
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  notes?: string | null;
  customCode?: string;
}

export interface RedeemCodeResult {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
  };
  token?: string;
  products?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  requiresWorksheet?: boolean;
}

// =============================================================================
// CODE GENERATION
// =============================================================================

/**
 * Generate a unique, readable code
 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars like 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

/**
 * Create a new lifetime code
 */
export async function createLifetimeCode(
  db: Pool,
  adminId: string,
  input: CreateCodeInput
): Promise<{ success: boolean; code?: LifetimeCode; error?: string }> {
  try {
    // Validate products exist
    if (!input.productIds || input.productIds.length === 0) {
      return { success: false, error: 'At least one product must be selected' };
    }

    const productCheck = await db.query(
      `SELECT id, name, slug FROM products WHERE id = ANY($1) AND active = TRUE`,
      [input.productIds]
    );

    if (productCheck.rowCount !== input.productIds.length) {
      return { success: false, error: 'One or more selected products are invalid' };
    }

    // Generate or use custom code
    let code = input.customCode?.toUpperCase().trim();
    if (!code) {
      code = generateCode();
    }

    // Check code uniqueness
    const existingCode = await db.query(
      `SELECT id FROM lifetime_codes WHERE code = $1`,
      [code]
    );

    if (existingCode.rowCount > 0) {
      return { success: false, error: 'This code already exists. Please use a different code.' };
    }

    // Create the code
    const codeResult = await db.query(
      `INSERT INTO lifetime_codes (code, name, max_redemptions, expires_at, notes, created_by_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        code,
        input.name,
        input.maxRedemptions || null,
        input.expiresAt || null,
        input.notes || null,
        adminId,
      ]
    );

    const codeRow = codeResult.rows[0];

    // Link products to the code
    for (const productId of input.productIds) {
      await db.query(
        `INSERT INTO lifetime_code_products (lifetime_code_id, product_id)
         VALUES ($1, $2)`,
        [codeRow.id, productId]
      );
    }

    // Return the created code with products
    return {
      success: true,
      code: {
        id: codeRow.id,
        code: codeRow.code,
        name: codeRow.name,
        maxRedemptions: codeRow.max_redemptions,
        redemptionsUsed: codeRow.redemptions_used,
        expiresAt: codeRow.expires_at,
        notes: codeRow.notes,
        isActive: codeRow.is_active,
        createdByAdminId: codeRow.created_by_admin_id,
        createdAt: codeRow.created_at,
        updatedAt: codeRow.updated_at,
        products: productCheck.rows.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        })),
      },
    };
  } catch (error: any) {
    console.error('[LifetimeCodes] Error creating code:', error);
    return { success: false, error: error.message || 'Failed to create code' };
  }
}

/**
 * Get all lifetime codes with stats
 */
export async function getLifetimeCodes(
  db: Pool,
  includeInactive = false
): Promise<LifetimeCode[]> {
  const whereClause = includeInactive ? '' : 'WHERE lc.is_active = TRUE';

  const result = await db.query(`
    SELECT lc.*,
           COALESCE(json_agg(
             json_build_object('id', p.id, 'name', p.name, 'slug', p.slug)
           ) FILTER (WHERE p.id IS NOT NULL), '[]') as products
    FROM lifetime_codes lc
    LEFT JOIN lifetime_code_products lcp ON lc.id = lcp.lifetime_code_id
    LEFT JOIN products p ON lcp.product_id = p.id
    ${whereClause}
    GROUP BY lc.id
    ORDER BY lc.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    maxRedemptions: row.max_redemptions,
    redemptionsUsed: row.redemptions_used,
    expiresAt: row.expires_at,
    notes: row.notes,
    isActive: row.is_active,
    createdByAdminId: row.created_by_admin_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    products: row.products,
  }));
}

/**
 * Get a single code with redemption details
 */
export async function getLifetimeCodeDetails(
  db: Pool,
  codeId: string
): Promise<{ code: LifetimeCode; redemptions: LifetimeCodeRedemption[] } | null> {
  // Get code with products
  const codeResult = await db.query(`
    SELECT lc.*,
           COALESCE(json_agg(
             json_build_object('id', p.id, 'name', p.name, 'slug', p.slug)
           ) FILTER (WHERE p.id IS NOT NULL), '[]') as products
    FROM lifetime_codes lc
    LEFT JOIN lifetime_code_products lcp ON lc.id = lcp.lifetime_code_id
    LEFT JOIN products p ON lcp.product_id = p.id
    WHERE lc.id = $1
    GROUP BY lc.id
  `, [codeId]);

  if (codeResult.rowCount === 0) {
    return null;
  }

  const row = codeResult.rows[0];

  // Get redemptions
  const redemptionsResult = await db.query(`
    SELECT lcr.*, u.email, u.first_name, u.last_name
    FROM lifetime_code_redemptions lcr
    JOIN users u ON lcr.user_id = u.id
    WHERE lcr.lifetime_code_id = $1
    ORDER BY lcr.redeemed_at DESC
  `, [codeId]);

  return {
    code: {
      id: row.id,
      code: row.code,
      name: row.name,
      maxRedemptions: row.max_redemptions,
      redemptionsUsed: row.redemptions_used,
      expiresAt: row.expires_at,
      notes: row.notes,
      isActive: row.is_active,
      createdByAdminId: row.created_by_admin_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      products: row.products,
    },
    redemptions: redemptionsResult.rows.map((r) => ({
      id: r.id,
      lifetimeCodeId: r.lifetime_code_id,
      userId: r.user_id,
      redeemedAt: r.redeemed_at,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      user: {
        email: r.email,
        firstName: r.first_name,
        lastName: r.last_name,
      },
    })),
  };
}

/**
 * Update a lifetime code
 */
export async function updateLifetimeCode(
  db: Pool,
  codeId: string,
  updates: Partial<{
    name: string;
    maxRedemptions: number | null;
    expiresAt: string | null;
    notes: string | null;
    isActive: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.maxRedemptions !== undefined) {
      setClauses.push(`max_redemptions = $${paramIndex++}`);
      values.push(updates.maxRedemptions);
    }
    if (updates.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      values.push(updates.expiresAt);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (setClauses.length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    values.push(codeId);

    await db.query(
      `UPDATE lifetime_codes SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    return { success: true };
  } catch (error: any) {
    console.error('[LifetimeCodes] Error updating code:', error);
    return { success: false, error: error.message || 'Failed to update code' };
  }
}

/**
 * Deactivate a code (soft delete)
 */
export async function deactivateLifetimeCode(
  db: Pool,
  codeId: string
): Promise<{ success: boolean; error?: string }> {
  return updateLifetimeCode(db, codeId, { isActive: false });
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a code for redemption
 */
export async function validateCode(
  db: Pool,
  code: string,
  userId?: string
): Promise<{
  valid: boolean;
  error?: string;
  code?: LifetimeCode;
}> {
  // Find the code
  const result = await db.query(`
    SELECT lc.*,
           COALESCE(json_agg(
             json_build_object('id', p.id, 'name', p.name, 'slug', p.slug)
           ) FILTER (WHERE p.id IS NOT NULL), '[]') as products
    FROM lifetime_codes lc
    LEFT JOIN lifetime_code_products lcp ON lc.id = lcp.lifetime_code_id
    LEFT JOIN products p ON lcp.product_id = p.id
    WHERE UPPER(lc.code) = UPPER($1)
    GROUP BY lc.id
  `, [code]);

  if (result.rowCount === 0) {
    return { valid: false, error: 'Invalid code' };
  }

  const row = result.rows[0];

  // Check if active
  if (!row.is_active) {
    return { valid: false, error: 'This code is no longer active' };
  }

  // Check if expired
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { valid: false, error: 'This code has expired' };
  }

  // Check redemption limit
  if (row.max_redemptions && row.redemptions_used >= row.max_redemptions) {
    return { valid: false, error: 'This code has reached its redemption limit' };
  }

  // Check if user already redeemed (if userId provided)
  if (userId) {
    const redemptionCheck = await db.query(
      `SELECT id FROM lifetime_code_redemptions WHERE lifetime_code_id = $1 AND user_id = $2`,
      [row.id, userId]
    );

    if (redemptionCheck.rowCount > 0) {
      return { valid: false, error: 'You have already redeemed this code' };
    }
  }

  return {
    valid: true,
    code: {
      id: row.id,
      code: row.code,
      name: row.name,
      maxRedemptions: row.max_redemptions,
      redemptionsUsed: row.redemptions_used,
      expiresAt: row.expires_at,
      notes: row.notes,
      isActive: row.is_active,
      createdByAdminId: row.created_by_admin_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      products: row.products,
    },
  };
}

// =============================================================================
// REDEMPTION
// =============================================================================

/**
 * Redeem a code for a new user (signup)
 */
export async function redeemCodeForNewUser(
  db: Pool,
  code: string,
  userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
  },
  meta: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<RedeemCodeResult> {
  try {
    // Validate the code
    const validation = await validateCode(db, code);
    if (!validation.valid || !validation.code) {
      return { success: false, message: validation.error || 'Invalid code' };
    }

    const lifetimeCode = validation.code;

    // Check if email already exists
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [userData.email]);
    if (emailCheck.rowCount > 0) {
      return {
        success: false,
        message: 'An account with this email already exists. Please sign in and redeem the code from Settings.',
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password);

    // Generate support key
    const supportKey = `AM-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Create user account
    const userResult = await db.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, company_name,
        account_status, support_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, support_key`,
      [
        userData.email,
        hashedPassword,
        userData.firstName,
        userData.lastName,
        userData.companyName || null,
        'active',
        supportKey,
      ]
    );

    const user = userResult.rows[0];

    // Grant access to all products in the code
    const grantedProducts: Array<{ id: string; name: string; slug: string }> = [];
    let hasCPG = false;

    for (const product of lifetimeCode.products || []) {
      const grantResult = await grantProductAccess(
        db,
        user.id,
        product.slug,
        lifetimeCode.createdByAdminId, // Use the admin who created the code
        `Lifetime access via code: ${lifetimeCode.code}`,
        undefined // No expiration = lifetime
      );

      if (grantResult.success) {
        grantedProducts.push(product);
        if (product.slug === 'cpu-cpg-calculator' || product.slug === 'cpg') {
          hasCPG = true;
        }
      } else {
        console.error(`[LifetimeCodes] Failed to grant ${product.slug}:`, grantResult.message);
      }
    }

    // Record the redemption
    await db.query(
      `INSERT INTO lifetime_code_redemptions (lifetime_code_id, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [lifetimeCode.id, user.id, meta.ipAddress || null, meta.userAgent || null]
    );

    // Increment redemption count
    await db.query(
      `UPDATE lifetime_codes SET redemptions_used = redemptions_used + 1 WHERE id = $1`,
      [lifetimeCode.id]
    );

    // Send welcome email (includes support key)
    try {
      await sendWelcomeEmail(user.email, userData.firstName, supportKey);
      console.log(`[LifetimeCodes] Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error('[LifetimeCodes] Failed to send welcome email:', emailError);
      // Don't fail the redemption if email fails
    }

    // Generate auth token
    const token = await generateUserToken(user.id, user.email);

    return {
      success: true,
      message: 'Code redeemed successfully!',
      user: {
        id: user.id,
        email: user.email,
        firstName: userData.firstName,
      },
      token,
      products: grantedProducts,
      requiresWorksheet: hasCPG,
    };
  } catch (error: any) {
    console.error('[LifetimeCodes] Error redeeming code for new user:', error);
    return { success: false, message: error.message || 'Failed to redeem code' };
  }
}

/**
 * Redeem a code for an existing user
 */
export async function redeemCodeForExistingUser(
  db: Pool,
  code: string,
  userId: string,
  meta: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<RedeemCodeResult> {
  try {
    // Validate the code
    const validation = await validateCode(db, code, userId);
    if (!validation.valid || !validation.code) {
      return { success: false, message: validation.error || 'Invalid code' };
    }

    const lifetimeCode = validation.code;

    // Get user info
    const userResult = await db.query(
      `SELECT id, email, first_name, support_key FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return { success: false, message: 'User not found' };
    }

    const user = userResult.rows[0];

    // Grant access to all products in the code
    const grantedProducts: Array<{ id: string; name: string; slug: string }> = [];
    let hasCPG = false;

    for (const product of lifetimeCode.products || []) {
      const grantResult = await grantProductAccess(
        db,
        userId,
        product.slug,
        lifetimeCode.createdByAdminId,
        `Lifetime access via code: ${lifetimeCode.code}`,
        undefined
      );

      if (grantResult.success) {
        grantedProducts.push(product);
        if (product.slug === 'cpu-cpg-calculator' || product.slug === 'cpg') {
          hasCPG = true;
        }
      } else {
        // User might already have access - not necessarily an error
        console.log(`[LifetimeCodes] Could not grant ${product.slug}:`, grantResult.message);
      }
    }

    if (grantedProducts.length === 0) {
      return {
        success: false,
        message: 'You already have access to all products in this code',
      };
    }

    // Record the redemption
    await db.query(
      `INSERT INTO lifetime_code_redemptions (lifetime_code_id, user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [lifetimeCode.id, userId, meta.ipAddress || null, meta.userAgent || null]
    );

    // Increment redemption count
    await db.query(
      `UPDATE lifetime_codes SET redemptions_used = redemptions_used + 1 WHERE id = $1`,
      [lifetimeCode.id]
    );

    // Send welcome email for the new product access
    try {
      await sendWelcomeEmail(user.email, user.first_name || 'there', user.support_key);
      console.log(`[LifetimeCodes] Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error('[LifetimeCodes] Failed to send welcome email:', emailError);
    }

    // Check if user needs to complete worksheet for CPG
    let requiresWorksheet = false;
    if (hasCPG) {
      // Check if user has completed a worksheet
      const worksheetCheck = await db.query(
        `SELECT id FROM lifetime_code_redemptions lcr
         WHERE lcr.user_id = $1
         LIMIT 1`, // Simplified check - we'll add proper worksheet tracking
        [userId]
      );
      // For now, assume they need worksheet if they got CPG
      requiresWorksheet = true;
    }

    return {
      success: true,
      message: `Access granted to ${grantedProducts.map((p) => p.name).join(', ')}`,
      products: grantedProducts,
      requiresWorksheet,
    };
  } catch (error: any) {
    console.error('[LifetimeCodes] Error redeeming code for existing user:', error);
    return { success: false, message: error.message || 'Failed to redeem code' };
  }
}
