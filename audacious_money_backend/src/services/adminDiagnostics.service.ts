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

  // Get recent emails (last 5)
  const recentEmailsResult = await db.query(`
    SELECT id, email_type, subject, delivery_status, sent_at
    FROM sent_emails
    WHERE user_id = $1
    ORDER BY sent_at DESC
    LIMIT 5
  `, [userId]);

  // Get recent notes (last 3)
  const recentNotesResult = await db.query(`
    SELECT un.id, un.note, un.note_type, un.created_at,
           COALESCE(au.first_name || ' ' || au.last_name, 'Admin') as created_by_name
    FROM user_notes un
    LEFT JOIN admin_users au ON un.created_by_admin_id = au.id
    WHERE un.user_id = $1
    ORDER BY un.created_at DESC
    LIMIT 3
  `, [userId]);

  // Get user tags
  const tagsResult = await db.query(`
    SELECT tag FROM user_tags WHERE user_id = $1 ORDER BY created_at DESC
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
    // Recent data for expanded panel
    recentEmails: recentEmailsResult.rows.map(e => ({
      id: e.id,
      emailType: e.email_type,
      subject: e.subject || '',
      status: e.delivery_status || 'sent',
      sentAt: e.sent_at,
      scheduledFor: null,
    })),
    recentNotes: recentNotesResult.rows.map(n => ({
      id: n.id,
      note: n.note,
      noteType: n.note_type,
      createdAt: n.created_at,
      createdByName: n.created_by_name,
    })),
    tags: tagsResult.rows.map(t => t.tag),
    suppressions: suppression ? [{
      type: suppression.suppression_type,
      createdAt: suppression.suppressed_at,
    }] : [],
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

  // Query sent emails from scheduled_emails table (where status='sent')
  // This is where workshop emails are tracked after being sent
  const scheduledSentResult = await db.query(`
    SELECT
      se.id,
      se.email_type,
      COALESCE(se.custom_subject, INITCAP(REPLACE(se.email_type, '_', ' ')) || ' Email') as subject,
      se.sent_at,
      'sent' as delivery_status,
      se.sent_at as delivery_status_updated_at,
      NULL as bounce_type,
      NULL as bounce_reason,
      NULL as opened_at,
      0 as open_count,
      NULL as clicked_at,
      0 as click_count,
      'system' as triggered_by,
      NULL as triggered_by_admin_name,
      se.custom_html_body as html_content,
      se.custom_text_body as text_content,
      w.cohort_name as workshop_name
    FROM scheduled_emails se
    LEFT JOIN workshops w ON se.workshop_id = w.id
    WHERE se.user_id = $1 AND se.status = 'sent'
    ORDER BY se.sent_at DESC
  `, [userId]);

  // Also query sent_emails table for manually sent/resent emails
  const manualSentResult = await db.query(`
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
    WHERE se.user_id = $1
    ORDER BY se.sent_at DESC
  `, [userId]);

  // Combine and sort results
  const allEmails = [...scheduledSentResult.rows, ...manualSentResult.rows]
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

  // Apply pagination
  const paginatedEmails = allEmails.slice(offset, offset + pageSize);
  const total = allEmails.length;

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
    emails: paginatedEmails.map(e => ({
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

// =============================================================================
// USER DATA EXPORT (GDPR)
// =============================================================================

export interface UserDataExport {
  exportedAt: string;
  exportedBy: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string | null;
    supportKey: string;
    accountStatus: string;
    emailVerified: boolean;
    isBeta: boolean;
    createdAt: string;
    lastLoginAt: string | null;
  };
  subscriptions: Array<{
    productName: string;
    productSlug: string;
    status: string;
    activatedAt: string;
    trialEndsAt: string | null;
    trialConverted: boolean;
    cancelledAt: string | null;
    stripeSubscriptionId: string | null;
  }>;
  payments: Array<{
    id: string;
    productName: string;
    amount: number;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }>;
  workshopEnrollments: Array<{
    workshopName: string;
    cohortName: string;
    enrolledAt: string;
    status: string;
    worksheetCompletedAt: string | null;
    trialExpiresAt: string | null;
    convertedToPaidAt: string | null;
  }>;
  emailHistory: Array<{
    emailType: string;
    subject: string;
    sentAt: string;
    deliveryStatus: string;
    openedAt: string | null;
    clickedAt: string | null;
  }>;
  charitySelections: Array<{
    charityName: string;
    selectedAt: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
  }>;
}

export async function exportUserData(
  db: Pool,
  userId: string,
  adminId: string
): Promise<UserDataExport | null> {
  // Get user basic info
  const userResult = await db.query(`
    SELECT
      id, email, first_name, last_name, company_name, support_key,
      account_status, email_verified, is_beta, created_at, last_login_at
    FROM users
    WHERE id = $1
  `, [userId]);

  if (userResult.rows.length === 0) {
    return null;
  }

  const user = userResult.rows[0];

  // Get subscriptions
  const subscriptionsResult = await db.query(`
    SELECT
      p.name as product_name, p.slug as product_slug,
      up.status, up.activated_at, up.trial_ends_at, up.trial_converted,
      up.cancelled_at, up.stripe_subscription_id
    FROM user_products up
    JOIN products p ON up.product_id = p.id
    WHERE up.user_id = $1
    ORDER BY up.activated_at DESC
  `, [userId]);

  // Get payments
  const paymentsResult = await db.query(`
    SELECT
      pay.id, p.name as product_name, pay.total_amount as amount,
      pay.status, pay.paid_at, pay.created_at
    FROM payments pay
    JOIN products p ON pay.product_id = p.id
    WHERE pay.user_id = $1
    ORDER BY pay.created_at DESC
  `, [userId]);

  // Get workshop enrollments
  const workshopsResult = await db.query(`
    SELECT
      w.workshop_name, w.cohort_name,
      we.enrolled_at, we.status, we.worksheet_completed_at,
      we.trial_expires_at, we.converted_to_paid_at
    FROM workshop_enrollments we
    JOIN workshops w ON we.workshop_id = w.id
    WHERE we.user_id = $1
    ORDER BY we.enrolled_at DESC
  `, [userId]);

  // Get email history (without content for size)
  const emailsResult = await db.query(`
    SELECT
      email_type, subject, sent_at, delivery_status, opened_at, clicked_at
    FROM sent_emails
    WHERE user_id = $1
    ORDER BY sent_at DESC
  `, [userId]);

  // Get charity selections
  const charitiesResult = await db.query(`
    SELECT
      c.name as charity_name, ucs.selected_at, ucs.effective_from, ucs.effective_until
    FROM user_charity_selections ucs
    JOIN charities c ON ucs.charity_id = c.id
    WHERE ucs.user_id = $1
    ORDER BY ucs.selected_at DESC
  `, [userId]);

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: adminId,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      companyName: user.company_name,
      supportKey: user.support_key,
      accountStatus: user.account_status,
      emailVerified: user.email_verified,
      isBeta: user.is_beta || false,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    },
    subscriptions: subscriptionsResult.rows.map(s => ({
      productName: s.product_name,
      productSlug: s.product_slug,
      status: s.status,
      activatedAt: s.activated_at,
      trialEndsAt: s.trial_ends_at,
      trialConverted: s.trial_converted || false,
      cancelledAt: s.cancelled_at,
      stripeSubscriptionId: s.stripe_subscription_id,
    })),
    payments: paymentsResult.rows.map(p => ({
      id: p.id,
      productName: p.product_name,
      amount: parseFloat(p.amount),
      status: p.status,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    })),
    workshopEnrollments: workshopsResult.rows.map(w => ({
      workshopName: w.workshop_name || w.cohort_name,
      cohortName: w.cohort_name,
      enrolledAt: w.enrolled_at,
      status: w.status || 'active',
      worksheetCompletedAt: w.worksheet_completed_at,
      trialExpiresAt: w.trial_expires_at,
      convertedToPaidAt: w.converted_to_paid_at,
    })),
    emailHistory: emailsResult.rows.map(e => ({
      emailType: e.email_type,
      subject: e.subject,
      sentAt: e.sent_at,
      deliveryStatus: e.delivery_status,
      openedAt: e.opened_at,
      clickedAt: e.clicked_at,
    })),
    charitySelections: charitiesResult.rows.map(c => ({
      charityName: c.charity_name,
      selectedAt: c.selected_at,
      effectiveFrom: c.effective_from,
      effectiveUntil: c.effective_until,
    })),
  };
}

// =============================================================================
// USER DELETION PREPARATION
// =============================================================================

export interface DeletionPreview {
  userId: string;
  email: string;
  name: string;
  subscriptionCount: number;
  stripeSubscriptions: string[];
  scheduledEmailsCount: number;
  sentEmailsCount: number;
  workshopEnrollmentsCount: number;
  paymentsCount: number;
  warnings: string[];
}

export async function getDeletionPreview(
  db: Pool,
  userId: string
): Promise<DeletionPreview | null> {
  // Get user basic info
  const userResult = await db.query(`
    SELECT id, email, first_name, last_name
    FROM users WHERE id = $1
  `, [userId]);

  if (userResult.rows.length === 0) {
    return null;
  }

  const user = userResult.rows[0];

  // Get counts
  const [subscriptions, scheduledEmails, sentEmails, workshopEnrollments, payments] = await Promise.all([
    db.query(`
      SELECT stripe_subscription_id
      FROM user_products
      WHERE user_id = $1 AND stripe_subscription_id IS NOT NULL
    `, [userId]),
    db.query(`SELECT COUNT(*) FROM scheduled_emails WHERE user_id = $1`, [userId]),
    db.query(`SELECT COUNT(*) FROM sent_emails WHERE user_id = $1`, [userId]),
    db.query(`SELECT COUNT(*) FROM workshop_enrollments WHERE user_id = $1`, [userId]),
    db.query(`SELECT COUNT(*) FROM payments WHERE user_id = $1`, [userId]),
  ]);

  const warnings: string[] = [];

  // Check for active subscriptions
  if (subscriptions.rows.length > 0) {
    warnings.push(`${subscriptions.rows.length} Stripe subscription(s) will be cancelled`);
  }

  // Check for pending scheduled emails
  const pendingEmailsResult = await db.query(`
    SELECT COUNT(*) FROM scheduled_emails
    WHERE user_id = $1 AND status IN ('pending', 'processing')
  `, [userId]);
  const pendingCount = parseInt(pendingEmailsResult.rows[0].count);
  if (pendingCount > 0) {
    warnings.push(`${pendingCount} pending email(s) will be cancelled`);
  }

  return {
    userId: user.id,
    email: user.email,
    name: `${user.first_name} ${user.last_name}`.trim(),
    subscriptionCount: subscriptions.rows.length,
    stripeSubscriptions: subscriptions.rows.map(r => r.stripe_subscription_id),
    scheduledEmailsCount: parseInt(scheduledEmails.rows[0].count),
    sentEmailsCount: parseInt(sentEmails.rows[0].count),
    workshopEnrollmentsCount: parseInt(workshopEnrollments.rows[0].count),
    paymentsCount: parseInt(payments.rows[0].count),
    warnings,
  };
}

export async function prepareUserDeletion(
  db: Pool,
  userId: string,
  adminId: string,
  reason: string
): Promise<{
  scheduledEmailsCancelled: number;
  suppressionsRemoved: number;
  userSnapshot: any;
}> {
  // 1. Cancel all pending scheduled emails
  const cancelResult = await db.query(`
    UPDATE scheduled_emails
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = $2,
        last_error = $3
    WHERE user_id = $1 AND status IN ('pending', 'processing')
  `, [userId, adminId, `User deleted: ${reason}`]);

  // 2. Remove from suppression list
  const suppressionResult = await db.query(`
    UPDATE email_suppressions
    SET reactivated_at = NOW(),
        reactivated_by_admin_id = $2,
        reactivation_reason = $3
    WHERE user_id = $1 AND reactivated_at IS NULL
  `, [userId, adminId, `User deleted: ${reason}`]);

  // 3. Create complete user snapshot for audit
  const userSnapshot = await exportUserData(db, userId, adminId);

  return {
    scheduledEmailsCancelled: cancelResult.rowCount || 0,
    suppressionsRemoved: suppressionResult.rowCount || 0,
    userSnapshot,
  };
}

// =============================================================================
// USER NOTES
// =============================================================================

export interface UserNote {
  id: string;
  userId: string;
  note: string;
  noteType: 'general' | 'support' | 'billing' | 'technical';
  createdByAdminId: string;
  createdByAdminName: string;
  updatedByAdminId: string | null;
  updatedByAdminName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getUserNotes(db: Pool, userId: string): Promise<UserNote[]> {
  const result = await db.query(`
    SELECT
      n.id, n.user_id, n.note, n.note_type,
      n.created_by_admin_id, n.updated_by_admin_id,
      n.created_at, n.updated_at,
      ca.first_name || ' ' || ca.last_name as created_by_admin_name,
      ua.first_name || ' ' || ua.last_name as updated_by_admin_name
    FROM user_notes n
    LEFT JOIN admin_users ca ON n.created_by_admin_id = ca.id
    LEFT JOIN admin_users ua ON n.updated_by_admin_id = ua.id
    WHERE n.user_id = $1
    ORDER BY n.created_at DESC
  `, [userId]);

  return result.rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    note: r.note,
    noteType: r.note_type,
    createdByAdminId: r.created_by_admin_id,
    createdByAdminName: r.created_by_admin_name || 'Unknown',
    updatedByAdminId: r.updated_by_admin_id,
    updatedByAdminName: r.updated_by_admin_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createUserNote(
  db: Pool,
  userId: string,
  adminId: string,
  note: string,
  noteType: 'general' | 'support' | 'billing' | 'technical' = 'general'
): Promise<string> {
  const result = await db.query(`
    INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [userId, note, noteType, adminId]);

  return result.rows[0].id;
}

export async function updateUserNote(
  db: Pool,
  noteId: string,
  adminId: string,
  note: string,
  noteType?: 'general' | 'support' | 'billing' | 'technical'
): Promise<boolean> {
  const result = await db.query(`
    UPDATE user_notes
    SET note = $2,
        note_type = COALESCE($3, note_type),
        updated_by_admin_id = $4,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id
  `, [noteId, note, noteType || null, adminId]);

  return result.rowCount > 0;
}

export async function deleteUserNote(db: Pool, noteId: string): Promise<boolean> {
  const result = await db.query(`
    DELETE FROM user_notes WHERE id = $1 RETURNING id
  `, [noteId]);

  return result.rowCount > 0;
}

// =============================================================================
// USER TAGS
// =============================================================================

export interface UserTag {
  id: string;
  userId: string;
  tag: string;
  createdByAdminId: string;
  createdByAdminName: string;
  createdAt: string;
}

export async function getUserTags(db: Pool, userId: string): Promise<UserTag[]> {
  const result = await db.query(`
    SELECT
      t.id, t.user_id, t.tag, t.created_by_admin_id, t.created_at,
      a.first_name || ' ' || a.last_name as created_by_admin_name
    FROM user_tags t
    LEFT JOIN admin_users a ON t.created_by_admin_id = a.id
    WHERE t.user_id = $1
    ORDER BY t.tag ASC
  `, [userId]);

  return result.rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    tag: r.tag,
    createdByAdminId: r.created_by_admin_id,
    createdByAdminName: r.created_by_admin_name || 'Unknown',
    createdAt: r.created_at,
  }));
}

export async function addUserTag(
  db: Pool,
  userId: string,
  adminId: string,
  tag: string
): Promise<string | null> {
  // Normalize tag: lowercase, trim, replace spaces with hyphens
  const normalizedTag = tag.toLowerCase().trim().replace(/\s+/g, '-');

  try {
    const result = await db.query(`
      INSERT INTO user_tags (user_id, tag, created_by_admin_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, tag) DO NOTHING
      RETURNING id
    `, [userId, normalizedTag, adminId]);

    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[AdminDiagnostics] Error adding tag:', error);
    return null;
  }
}

export async function removeUserTag(db: Pool, userId: string, tag: string): Promise<boolean> {
  const normalizedTag = tag.toLowerCase().trim().replace(/\s+/g, '-');

  const result = await db.query(`
    DELETE FROM user_tags WHERE user_id = $1 AND tag = $2 RETURNING id
  `, [userId, normalizedTag]);

  return result.rowCount > 0;
}

export async function getAllTags(db: Pool): Promise<Array<{ tag: string; userCount: number }>> {
  const result = await db.query(`
    SELECT tag, COUNT(*) as user_count
    FROM user_tags
    GROUP BY tag
    ORDER BY user_count DESC, tag ASC
  `);

  return result.rows.map(r => ({
    tag: r.tag,
    userCount: parseInt(r.user_count),
  }));
}

// =============================================================================
// ACCOUNT FREEZE/UNFREEZE
// =============================================================================

export interface FreezeResult {
  success: boolean;
  message: string;
  frozenAt?: string;
}

export async function freezeUserAccount(
  db: Pool,
  userId: string,
  adminId: string,
  reason: string
): Promise<FreezeResult> {
  try {
    // Update all user's products to frozen status
    const result = await db.query(`
      UPDATE user_products
      SET status = 'frozen',
          frozen_at = NOW(),
          frozen_reason = $2,
          frozen_by_admin_id = $3
      WHERE user_id = $1
        AND status NOT IN ('cancelled', 'canceled', 'expired')
      RETURNING id, frozen_at
    `, [userId, reason, adminId]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'No active products found to freeze',
      };
    }

    // Also mark user as needing attention
    await db.query(`
      UPDATE users
      SET needs_attention = TRUE,
          needs_attention_reason = $2
      WHERE id = $1
    `, [userId, `Account frozen: ${reason}`]);

    // Add admin note about the freeze
    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, $2, 'support', $3)
    `, [userId, `Account frozen. Reason: ${reason}`, adminId]);

    return {
      success: true,
      message: 'Account frozen successfully',
      frozenAt: result.rows[0].frozen_at,
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error freezing account:', error);
    return {
      success: false,
      message: 'Failed to freeze account',
    };
  }
}

export async function unfreezeUserAccount(
  db: Pool,
  userId: string,
  adminId: string
): Promise<FreezeResult> {
  try {
    // Get the previous status before freeze (default to active)
    const result = await db.query(`
      UPDATE user_products
      SET status = 'active',
          frozen_at = NULL,
          frozen_reason = NULL,
          frozen_by_admin_id = NULL
      WHERE user_id = $1
        AND status = 'frozen'
      RETURNING id
    `, [userId]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'No frozen products found',
      };
    }

    // Clear needs attention flag
    await db.query(`
      UPDATE users
      SET needs_attention = FALSE,
          needs_attention_reason = NULL
      WHERE id = $1
        AND needs_attention_reason LIKE 'Account frozen:%'
    `, [userId]);

    // Add admin note about the unfreeze
    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, 'Account unfrozen.', 'support', $2)
    `, [userId, adminId]);

    return {
      success: true,
      message: 'Account unfrozen successfully',
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error unfreezing account:', error);
    return {
      success: false,
      message: 'Failed to unfreeze account',
    };
  }
}

export async function setNeedsAttention(
  db: Pool,
  userId: string,
  needsAttention: boolean,
  reason?: string
): Promise<boolean> {
  try {
    await db.query(`
      UPDATE users
      SET needs_attention = $2,
          needs_attention_reason = $3
      WHERE id = $1
    `, [userId, needsAttention, reason || null]);

    return true;
  } catch (error) {
    console.error('[AdminDiagnostics] Error updating needs attention:', error);
    return false;
  }
}

// =============================================================================
// FILTER OPTIONS
// =============================================================================

export interface FilterOptions {
  products: Array<{ slug: string; name: string }>;
  workshops: Array<{ id: string; name: string }>;
  tags: Array<{ tag: string; userCount: number }>;
}

export async function getFilterOptions(db: Pool): Promise<FilterOptions> {
  // Get products
  const productsResult = await db.query(`
    SELECT slug, name FROM products WHERE active = TRUE ORDER BY name ASC
  `);

  // Get workshops
  const workshopsResult = await db.query(`
    SELECT id, name FROM educational_workshops WHERE is_active = TRUE ORDER BY name ASC
  `);

  // Get tags
  const tagsResult = await db.query(`
    SELECT tag, COUNT(*) as user_count
    FROM user_tags
    GROUP BY tag
    ORDER BY user_count DESC, tag ASC
    LIMIT 50
  `);

  return {
    products: productsResult.rows.map(r => ({ slug: r.slug, name: r.name })),
    workshops: workshopsResult.rows.map(r => ({ id: r.id, name: r.name })),
    tags: tagsResult.rows.map(r => ({ tag: r.tag, userCount: parseInt(r.user_count) })),
  };
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

export interface SubscriptionActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Pause a user's subscription
 * Sets status to 'paused' and records pause date
 */
export async function pauseSubscription(
  db: Pool,
  userId: string,
  userProductId: string,
  adminId: string,
  pauseUntil?: string
): Promise<SubscriptionActionResult> {
  try {
    const result = await db.query(`
      UPDATE user_products
      SET status = 'paused',
          paused_at = NOW(),
          resumed_at = NULL
      WHERE id = $1 AND user_id = $2
        AND status IN ('active', 'trialing')
      RETURNING id, status
    `, [userProductId, userId]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Product not found or not in pausable state',
      };
    }

    // Add admin note
    const pauseNote = pauseUntil
      ? `Subscription paused by admin until ${pauseUntil}.`
      : 'Subscription paused by admin (indefinite).';

    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, $2, 'billing', $3)
    `, [userId, pauseNote, adminId]);

    return {
      success: true,
      message: 'Subscription paused successfully',
      data: { pausedAt: new Date().toISOString() },
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error pausing subscription:', error);
    return {
      success: false,
      message: 'Failed to pause subscription',
    };
  }
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(
  db: Pool,
  userId: string,
  userProductId: string,
  adminId: string
): Promise<SubscriptionActionResult> {
  try {
    const result = await db.query(`
      UPDATE user_products
      SET status = 'active',
          resumed_at = NOW(),
          paused_at = NULL
      WHERE id = $1 AND user_id = $2
        AND status = 'paused'
      RETURNING id, status
    `, [userProductId, userId]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Product not found or not paused',
      };
    }

    // Add admin note
    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, 'Subscription resumed by admin.', 'billing', $2)
    `, [userId, adminId]);

    return {
      success: true,
      message: 'Subscription resumed successfully',
      data: { resumedAt: new Date().toISOString() },
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error resuming subscription:', error);
    return {
      success: false,
      message: 'Failed to resume subscription',
    };
  }
}

/**
 * Cancel a user's subscription
 */
export async function cancelSubscription(
  db: Pool,
  userId: string,
  userProductId: string,
  adminId: string,
  reason: string,
  immediate: boolean = false
): Promise<SubscriptionActionResult> {
  try {
    // If immediate, cancel now. Otherwise, set to cancel at period end.
    const updateQuery = immediate
      ? `
        UPDATE user_products
        SET status = 'cancelled',
            cancelled_at = NOW()
        WHERE id = $1 AND user_id = $2
          AND status NOT IN ('cancelled', 'canceled', 'expired')
        RETURNING id
      `
      : `
        UPDATE user_products
        SET cancel_at_period_end = TRUE
        WHERE id = $1 AND user_id = $2
          AND status NOT IN ('cancelled', 'canceled', 'expired')
        RETURNING id
      `;

    const result = await db.query(updateQuery, [userProductId, userId]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Product not found or already cancelled',
      };
    }

    // Add admin note
    const cancelNote = immediate
      ? `Subscription cancelled immediately by admin. Reason: ${reason}`
      : `Subscription set to cancel at period end by admin. Reason: ${reason}`;

    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, $2, 'billing', $3)
    `, [userId, cancelNote, adminId]);

    return {
      success: true,
      message: immediate ? 'Subscription cancelled' : 'Subscription will cancel at period end',
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error cancelling subscription:', error);
    return {
      success: false,
      message: 'Failed to cancel subscription',
    };
  }
}

/**
 * Extend a user's trial period
 */
export async function extendTrial(
  db: Pool,
  userId: string,
  userProductId: string,
  adminId: string,
  extendDays: number
): Promise<SubscriptionActionResult> {
  try {
    const result = await db.query(`
      UPDATE user_products
      SET current_period_end = COALESCE(current_period_end, NOW()) + INTERVAL '1 day' * $3
      WHERE id = $1 AND user_id = $2
        AND status = 'trialing'
      RETURNING id, current_period_end
    `, [userProductId, userId, extendDays]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Product not found or not in trial',
      };
    }

    // Add admin note
    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, $2, 'billing', $3)
    `, [userId, `Trial extended by ${extendDays} days by admin.`, adminId]);

    return {
      success: true,
      message: `Trial extended by ${extendDays} days`,
      data: { newEndDate: result.rows[0].current_period_end },
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error extending trial:', error);
    return {
      success: false,
      message: 'Failed to extend trial',
    };
  }
}

/**
 * Grant a product to a user (complimentary access)
 */
export async function grantProductAccess(
  db: Pool,
  userId: string,
  productSlug: string,
  adminId: string,
  reason: string,
  expiresAt?: string
): Promise<SubscriptionActionResult> {
  try {
    // Get product ID
    const productResult = await db.query(`
      SELECT id, name FROM products WHERE slug = $1 AND active = TRUE
    `, [productSlug]);

    if (productResult.rowCount === 0) {
      return {
        success: false,
        message: 'Product not found',
      };
    }

    const product = productResult.rows[0];

    // Check if user already has this product
    const existingResult = await db.query(`
      SELECT id FROM user_products
      WHERE user_id = $1 AND product_id = $2
        AND status NOT IN ('cancelled', 'canceled', 'expired')
    `, [userId, product.id]);

    if (existingResult.rowCount > 0) {
      return {
        success: false,
        message: 'User already has access to this product',
      };
    }

    // Grant access
    const insertResult = await db.query(`
      INSERT INTO user_products (
        user_id, product_id, status, activated_at,
        current_period_end, is_complimentary
      )
      VALUES ($1, $2, 'active', NOW(), $3, TRUE)
      RETURNING id
    `, [userId, product.id, expiresAt || null]);

    // Add admin note
    const accessNote = expiresAt
      ? `Granted complimentary access to ${product.name} until ${expiresAt}. Reason: ${reason}`
      : `Granted complimentary access to ${product.name} (no expiration). Reason: ${reason}`;

    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, $2, 'billing', $3)
    `, [userId, accessNote, adminId]);

    return {
      success: true,
      message: `Access granted to ${product.name}`,
      data: { userProductId: insertResult.rows[0].id },
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error granting access:', error);
    return {
      success: false,
      message: 'Failed to grant access',
    };
  }
}

/**
 * Revoke a user's product access
 */
export async function revokeProductAccess(
  db: Pool,
  userId: string,
  userProductId: string,
  adminId: string,
  reason: string
): Promise<SubscriptionActionResult> {
  try {
    const result = await db.query(`
      UPDATE user_products
      SET status = 'cancelled',
          cancelled_at = NOW()
      WHERE id = $1 AND user_id = $2
        AND status NOT IN ('cancelled', 'canceled', 'expired')
      RETURNING id, product_id
    `, [userProductId, userId]);

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Product access not found or already revoked',
      };
    }

    // Get product name for note
    const productResult = await db.query(`
      SELECT name FROM products WHERE id = $1
    `, [result.rows[0].product_id]);

    const productName = productResult.rows[0]?.name || 'Unknown product';

    // Add admin note
    await db.query(`
      INSERT INTO user_notes (user_id, note, note_type, created_by_admin_id)
      VALUES ($1, $2, 'billing', $3)
    `, [userId, `Access to ${productName} revoked by admin. Reason: ${reason}`, adminId]);

    return {
      success: true,
      message: 'Access revoked successfully',
    };
  } catch (error) {
    console.error('[AdminDiagnostics] Error revoking access:', error);
    return {
      success: false,
      message: 'Failed to revoke access',
    };
  }
}

/**
 * Get user's subscription details for admin panel
 */
export async function getUserSubscriptions(
  db: Pool,
  userId: string
): Promise<Array<{
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  status: string;
  activatedAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  isComplimentary: boolean;
}>> {
  const result = await db.query(`
    SELECT
      up.id, up.product_id, p.name as product_name, p.slug as product_slug,
      up.status, up.activated_at, up.current_period_start, up.current_period_end,
      up.paused_at, up.cancelled_at, up.stripe_subscription_id, up.stripe_customer_id,
      COALESCE(up.is_complimentary, FALSE) as is_complimentary
    FROM user_products up
    JOIN products p ON up.product_id = p.id
    WHERE up.user_id = $1
    ORDER BY up.activated_at DESC
  `, [userId]);

  return result.rows.map(r => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    productSlug: r.product_slug,
    status: r.status,
    activatedAt: r.activated_at,
    currentPeriodStart: r.current_period_start,
    currentPeriodEnd: r.current_period_end,
    pausedAt: r.paused_at,
    cancelledAt: r.cancelled_at,
    stripeSubscriptionId: r.stripe_subscription_id,
    stripeCustomerId: r.stripe_customer_id,
    isComplimentary: r.is_complimentary,
  }));
}
