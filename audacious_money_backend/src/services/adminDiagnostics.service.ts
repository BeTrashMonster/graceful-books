/**
 * Admin Diagnostics Service
 *
 * Provides comprehensive user diagnostic data for admin support interface.
 * Implements tiered data architecture:
 * - Tier 1: Summary for row display
 * - Tier 2: Cards for expanded panel
 * - Tier 3: Full history for detail page
 */

import { Pool } from 'pg';

// =============================================================================
// TYPES
// =============================================================================

export interface StatusBadge {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'purple';
  details?: string;
}

export interface WorkshopBadge {
  cohortName: string;
  shortName: string;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  supportKey: string;
  statusBadge: StatusBadge;
  workshopBadge: WorkshopBadge | null;
  isBeta: boolean;
}

export interface AccountCard {
  userId: string;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerified: boolean;
  accountStatus: string;
  isBeta: boolean;
}

export interface ProductSubscription {
  name: string;
  slug: string;
  status: string;
  activatedAt: string;
  trialEndsAt: string | null;
  trialConverted: boolean;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface SubscriptionCard {
  products: ProductSubscription[];
}

export interface WorkshopCard {
  workshopId: string;
  cohortName: string;
  enrolledAt: string;
  status: string;
  trialExpiresAt: string | null;
  convertedToPaidAt: string | null;
  worksheetCompletedAt: string | null;
  firstLoginAt: string | null;
  lastActiveAt: string | null;
  emailsSentCount: number;
}

export interface HealthCard {
  isFrozen: boolean;
  frozenReason: string | null;
  hasPaymentIssue: boolean;
  issuesSummary: string[];
}

export interface EmailHealthCard {
  isSuppressed: boolean;
  suppressionType: string | null;
  totalEmailsSent: number;
  totalOpened: number;
  totalClicked: number;
  lastEmailSentAt: string | null;
  lastOpenedAt: string | null;
  bounceCount: number;
}

export interface UserDetailsResponse {
  summary: UserSummary;
  cards: {
    account: AccountCard;
    subscription: SubscriptionCard;
    workshop: WorkshopCard | null;
    health: HealthCard;
    emailHealth: EmailHealthCard;
  };
}

export interface EmailHistoryItem {
  id: string;
  emailType: string;
  subject: string;
  sentAt: string;
  deliveryStatus: string;
  deliveryStatusUpdatedAt: string | null;
  bounceType: string | null;
  bounceReason: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  triggeredBy: string;
  triggeredByAdminName: string | null;
  htmlContent: string;
  textContent: string | null;
  workshopName: string | null;
}

export interface ScheduledEmailItem {
  id: string;
  emailType: string;
  subject: string | null;
  scheduledFor: string;
  status: string;
  workshopName: string | null;
}

export interface SuppressionInfo {
  isSuppressed: boolean;
  suppressionType: string | null;
  suppressedAt: string | null;
  reason: string | null;
}

export interface EmailHistoryResponse {
  emails: EmailHistoryItem[];
  scheduled: ScheduledEmailItem[];
  suppression: SuppressionInfo | null;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}

// =============================================================================
// STATUS BADGE COMPUTATION
// =============================================================================

interface UserForBadge {
  isBeta: boolean;
  accountStatus: string;
  products: Array<{
    status: string;
    trialEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    pausedAt: string | null;
  }>;
  workshopTrialExpiresAt: string | null;
  workshopConvertedToPaidAt: string | null;
}

function daysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isPastDate(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function computeStatusBadge(user: UserForBadge): StatusBadge {
  // Priority order (highest first)

  // 1. Beta users
  if (user.isBeta) {
    return { label: 'BETA', variant: 'purple' };
  }

  // 2. Account suspended
  if (user.accountStatus === 'suspended') {
    return { label: 'SUSPENDED', variant: 'error' };
  }

  // 3. Account cancelled
  if (user.accountStatus === 'cancelled') {
    return { label: 'CANCELLED', variant: 'error' };
  }

  // Check products for status
  const activeProducts = user.products.filter(p =>
    ['active', 'trialing', 'paused'].includes(p.status)
  );

  // 4. No active products - check workshop
  if (activeProducts.length === 0) {
    // Workshop trial expired?
    if (user.workshopTrialExpiresAt && isPastDate(user.workshopTrialExpiresAt) && !user.workshopConvertedToPaidAt) {
      return { label: 'FROZEN', variant: 'error', details: 'Workshop trial expired' };
    }

    // Check if any product is expired/cancelled
    const hasExpired = user.products.some(p => p.status === 'expired' || p.status === 'cancelled');
    if (hasExpired) {
      return { label: 'FROZEN', variant: 'error', details: 'Subscription ended' };
    }

    return { label: 'NO SUBSCRIPTION', variant: 'error' };
  }

  // 5. Payment issues (grace period)
  const productWithGrace = activeProducts.find(p => p.gracePeriodEndsAt && !isPastDate(p.gracePeriodEndsAt));
  if (productWithGrace && productWithGrace.gracePeriodEndsAt) {
    const daysLeft = daysUntil(productWithGrace.gracePeriodEndsAt);
    return {
      label: 'PAYMENT ISSUE',
      variant: 'error',
      details: `Grace period: ${daysLeft} days left`
    };
  }

  // 6. Paused
  const pausedProduct = activeProducts.find(p => p.status === 'paused');
  if (pausedProduct) {
    return { label: 'PAUSED', variant: 'info' };
  }

  // 7. Trial with days remaining
  const trialingProduct = activeProducts.find(p => p.status === 'trialing' && p.trialEndsAt);
  if (trialingProduct && trialingProduct.trialEndsAt) {
    const daysLeft = daysUntil(trialingProduct.trialEndsAt);
    if (daysLeft <= 3 && daysLeft > 0) {
      return {
        label: `TRIAL (${daysLeft}d)`,
        variant: 'warning',
        details: `Trial ends ${new Date(trialingProduct.trialEndsAt).toLocaleDateString()}`
      };
    }
    if (daysLeft > 0) {
      return {
        label: `TRIAL (${daysLeft}d)`,
        variant: 'info',
        details: `Trial ends ${new Date(trialingProduct.trialEndsAt).toLocaleDateString()}`
      };
    }
    // Trial expired but not yet cancelled
    return { label: 'TRIAL EXPIRED', variant: 'error' };
  }

  // 8. Workshop trial
  if (user.workshopTrialExpiresAt && !user.workshopConvertedToPaidAt) {
    const daysLeft = daysUntil(user.workshopTrialExpiresAt);
    if (daysLeft <= 3 && daysLeft > 0) {
      return {
        label: `TRIAL (${daysLeft}d)`,
        variant: 'warning',
        details: `Workshop trial ends ${new Date(user.workshopTrialExpiresAt).toLocaleDateString()}`
      };
    }
    if (daysLeft > 0) {
      return {
        label: `TRIAL (${daysLeft}d)`,
        variant: 'info',
        details: `Workshop trial ends ${new Date(user.workshopTrialExpiresAt).toLocaleDateString()}`
      };
    }
  }

  // 9. Active - all good
  const hasActive = activeProducts.some(p => p.status === 'active');
  if (hasActive) {
    return { label: 'ACTIVE', variant: 'success' };
  }

  // Default fallback
  return { label: 'UNKNOWN', variant: 'info' };
}

// =============================================================================
// USER DETAILS QUERY
// =============================================================================

export async function getUserDetails(db: Pool, userId: string): Promise<UserDetailsResponse | null> {
  // Get user basic info
  const userResult = await db.query(`
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.company_name,
      u.support_key, u.account_status, u.email_verified,
      u.created_at, u.last_login_at, u.is_beta, u.stripe_customer_id,
      u.current_workshop_enrollment_id
    FROM users u
    WHERE u.id = $1
  `, [userId]);

  if (userResult.rows.length === 0) {
    return null;
  }

  const user = userResult.rows[0];

  // Get user products
  const productsResult = await db.query(`
    SELECT
      p.name, p.slug,
      up.status, up.activated_at, up.trial_ends_at, up.trial_converted,
      up.current_period_end, up.grace_period_ends_at, up.paused_at,
      up.cancelled_at, up.stripe_subscription_id
    FROM user_products up
    JOIN products p ON up.product_id = p.id
    WHERE up.user_id = $1
    ORDER BY up.activated_at DESC
  `, [userId]);

  // Get workshop enrollment if exists
  let workshopCard: WorkshopCard | null = null;
  if (user.current_workshop_enrollment_id) {
    const workshopResult = await db.query(`
      SELECT
        we.id, we.workshop_id, we.enrolled_at, we.worksheet_completed_at,
        we.trial_expires_at, we.converted_to_paid_at, we.status,
        we.first_login_at, we.last_active_at,
        w.cohort_name,
        (SELECT COUNT(*) FROM scheduled_emails se WHERE se.enrollment_id = we.id AND se.status = 'sent') as emails_sent_count
      FROM workshop_enrollments we
      JOIN workshops w ON we.workshop_id = w.id
      WHERE we.id = $1
    `, [user.current_workshop_enrollment_id]);

    if (workshopResult.rows.length > 0) {
      const we = workshopResult.rows[0];
      workshopCard = {
        workshopId: we.workshop_id,
        cohortName: we.cohort_name,
        enrolledAt: we.enrolled_at,
        status: we.status || 'active',
        trialExpiresAt: we.trial_expires_at,
        convertedToPaidAt: we.converted_to_paid_at,
        worksheetCompletedAt: we.worksheet_completed_at,
        firstLoginAt: we.first_login_at,
        lastActiveAt: we.last_active_at,
        emailsSentCount: parseInt(we.emails_sent_count) || 0,
      };
    }
  }

  // Get email health stats
  const emailStatsResult = await db.query(`
    SELECT
      COUNT(*) as total_sent,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as total_opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as total_clicked,
      MAX(sent_at) as last_email_sent_at,
      MAX(opened_at) as last_opened_at,
      COUNT(*) FILTER (WHERE delivery_status IN ('bounced', 'failed')) as bounce_count
    FROM sent_emails
    WHERE user_id = $1
  `, [userId]);

  // Get suppression status
  const suppressionResult = await db.query(`
    SELECT suppression_type, suppressed_at, suppression_reason
    FROM email_suppressions
    WHERE user_id = $1 AND reactivated_at IS NULL
    LIMIT 1
  `, [userId]);

  const emailStats = emailStatsResult.rows[0];
  const suppression = suppressionResult.rows[0];

  // Build products array for badge computation
  const productsForBadge = productsResult.rows.map(p => ({
    status: p.status,
    trialEndsAt: p.trial_ends_at,
    gracePeriodEndsAt: p.grace_period_ends_at,
    pausedAt: p.paused_at,
  }));

  // Compute status badge
  const statusBadge = computeStatusBadge({
    isBeta: user.is_beta || false,
    accountStatus: user.account_status,
    products: productsForBadge,
    workshopTrialExpiresAt: workshopCard?.trialExpiresAt || null,
    workshopConvertedToPaidAt: workshopCard?.convertedToPaidAt || null,
  });

  // Build workshop badge
  let workshopBadge: WorkshopBadge | null = null;
  if (workshopCard) {
    // Create short name from cohort (e.g., "October 2026 Cohort" -> "Oct 2026")
    const cohortName = workshopCard.cohortName;
    const monthMatch = cohortName.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    const shortName = monthMatch
      ? `${monthMatch[1].substring(0, 3)} ${monthMatch[2]}`
      : cohortName.substring(0, 10);

    workshopBadge = {
      cohortName: workshopCard.cohortName,
      shortName,
    };
  }

  // Build health card
  const isFrozen = statusBadge.variant === 'error' &&
    ['FROZEN', 'SUSPENDED', 'CANCELLED', 'TRIAL EXPIRED', 'NO SUBSCRIPTION'].includes(statusBadge.label);

  const hasPaymentIssue = statusBadge.label === 'PAYMENT ISSUE';

  const issuesSummary: string[] = [];
  if (isFrozen) issuesSummary.push(statusBadge.details || statusBadge.label);
  if (hasPaymentIssue) issuesSummary.push(statusBadge.details || 'Payment issue');
  if (suppression) issuesSummary.push(`Email suppressed: ${suppression.suppression_type}`);

  return {
    summary: {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`.trim(),
      companyName: user.company_name,
      supportKey: user.support_key,
      statusBadge,
      workshopBadge,
      isBeta: user.is_beta || false,
    },
    cards: {
      account: {
        userId: user.id,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        emailVerified: user.email_verified,
        accountStatus: user.account_status,
        isBeta: user.is_beta || false,
      },
      subscription: {
        products: productsResult.rows.map(p => ({
          name: p.name,
          slug: p.slug,
          status: p.status,
          activatedAt: p.activated_at,
          trialEndsAt: p.trial_ends_at,
          trialConverted: p.trial_converted || false,
          currentPeriodEnd: p.current_period_end,
          gracePeriodEndsAt: p.grace_period_ends_at,
          pausedAt: p.paused_at,
          cancelledAt: p.cancelled_at,
          stripeCustomerId: user.stripe_customer_id,
          stripeSubscriptionId: p.stripe_subscription_id,
        })),
      },
      workshop: workshopCard,
      health: {
        isFrozen,
        frozenReason: isFrozen ? (statusBadge.details || statusBadge.label) : null,
        hasPaymentIssue,
        issuesSummary,
      },
      emailHealth: {
        isSuppressed: !!suppression,
        suppressionType: suppression?.suppression_type || null,
        totalEmailsSent: parseInt(emailStats.total_sent) || 0,
        totalOpened: parseInt(emailStats.total_opened) || 0,
        totalClicked: parseInt(emailStats.total_clicked) || 0,
        lastEmailSentAt: emailStats.last_email_sent_at,
        lastOpenedAt: emailStats.last_opened_at,
        bounceCount: parseInt(emailStats.bounce_count) || 0,
      },
    },
  };
}

// =============================================================================
// EMAIL HISTORY QUERY
// =============================================================================

export async function getUserEmailHistory(
  db: Pool,
  userId: string,
  options: {
    page?: number;
    pageSize?: number;
    emailType?: string;
    status?: string;
  } = {}
): Promise<EmailHistoryResponse> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const offset = (page - 1) * pageSize;

  // Build WHERE clause for filters
  let whereClause = 'WHERE se.user_id = $1';
  const params: any[] = [userId];
  let paramIndex = 2;

  if (options.emailType) {
    whereClause += ` AND se.email_type = $${paramIndex}`;
    params.push(options.emailType);
    paramIndex++;
  }

  if (options.status) {
    whereClause += ` AND se.delivery_status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM sent_emails se ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get emails with pagination
  const emailsResult = await db.query(`
    SELECT
      se.id, se.email_type, se.subject, se.sent_at,
      se.delivery_status, se.delivery_status_updated_at,
      se.bounce_type, se.bounce_reason,
      se.opened_at, se.open_count, se.clicked_at, se.click_count,
      se.triggered_by, se.html_content, se.text_content,
      a.first_name || ' ' || a.last_name as triggered_by_admin_name,
      w.cohort_name as workshop_name
    FROM sent_emails se
    LEFT JOIN admin_users a ON se.triggered_by_admin_id = a.id
    LEFT JOIN workshops w ON se.workshop_id = w.id
    ${whereClause}
    ORDER BY se.sent_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `, [...params, pageSize, offset]);

  // Get scheduled emails
  const scheduledResult = await db.query(`
    SELECT
      se.id, se.email_type, se.custom_subject as subject,
      se.scheduled_for, se.status,
      w.cohort_name as workshop_name
    FROM scheduled_emails se
    LEFT JOIN workshops w ON se.workshop_id = w.id
    WHERE se.user_id = $1 AND se.status IN ('pending', 'processing')
    ORDER BY se.scheduled_for ASC
  `, [userId]);

  // Get suppression status
  const suppressionResult = await db.query(`
    SELECT suppression_type, suppressed_at, suppression_reason
    FROM email_suppressions
    WHERE user_id = $1 AND reactivated_at IS NULL
    LIMIT 1
  `, [userId]);

  const suppression = suppressionResult.rows[0];

  return {
    emails: emailsResult.rows.map(e => ({
      id: e.id,
      emailType: e.email_type,
      subject: e.subject,
      sentAt: e.sent_at,
      deliveryStatus: e.delivery_status,
      deliveryStatusUpdatedAt: e.delivery_status_updated_at,
      bounceType: e.bounce_type,
      bounceReason: e.bounce_reason,
      openedAt: e.opened_at,
      openCount: e.open_count || 0,
      clickedAt: e.clicked_at,
      clickCount: e.click_count || 0,
      triggeredBy: e.triggered_by,
      triggeredByAdminName: e.triggered_by_admin_name,
      htmlContent: e.html_content,
      textContent: e.text_content,
      workshopName: e.workshop_name,
    })),
    scheduled: scheduledResult.rows.map(s => ({
      id: s.id,
      emailType: s.email_type,
      subject: s.subject,
      scheduledFor: s.scheduled_for,
      status: s.status,
      workshopName: s.workshop_name,
    })),
    suppression: suppression ? {
      isSuppressed: true,
      suppressionType: suppression.suppression_type,
      suppressedAt: suppression.suppressed_at,
      reason: suppression.suppression_reason,
    } : null,
    pagination: {
      total,
      page,
      pageSize,
    },
  };
}

// =============================================================================
// SUPPRESSION MANAGEMENT
// =============================================================================

export async function addUserSuppression(
  db: Pool,
  userId: string,
  email: string,
  adminId: string,
  reason: string,
  emailTypes?: string[]
): Promise<void> {
  await db.query(`
    INSERT INTO email_suppressions (
      email, user_id, suppression_type, suppression_reason,
      email_types, suppressed_by_admin_id
    ) VALUES ($1, $2, 'manual', $3, $4, $5)
    ON CONFLICT (email) WHERE reactivated_at IS NULL
    DO UPDATE SET
      suppression_reason = EXCLUDED.suppression_reason,
      email_types = EXCLUDED.email_types
  `, [email, userId, reason, emailTypes || [], adminId]);
}

export async function removeUserSuppression(
  db: Pool,
  userId: string,
  adminId: string,
  reason?: string
): Promise<void> {
  await db.query(`
    UPDATE email_suppressions
    SET reactivated_at = NOW(),
        reactivated_by_admin_id = $2,
        reactivation_reason = $3
    WHERE user_id = $1 AND reactivated_at IS NULL
  `, [userId, adminId, reason || null]);
}

// =============================================================================
// CANCEL SCHEDULED EMAIL
// =============================================================================

export async function cancelScheduledEmail(
  db: Pool,
  scheduledEmailId: string,
  adminId: string,
  reason?: string
): Promise<boolean> {
  const result = await db.query(`
    UPDATE scheduled_emails
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = $2,
        last_error = $3
    WHERE id = $1 AND status IN ('pending', 'processing')
    RETURNING id
  `, [scheduledEmailId, adminId, reason || 'Cancelled by admin']);

  return result.rowCount > 0;
}
