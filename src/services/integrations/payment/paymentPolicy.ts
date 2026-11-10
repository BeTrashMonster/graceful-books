/**
 * Payment Integration Security Policy
 *
 * Payment integrations have the highest security requirements.
 * AI and automated systems CANNOT initiate payments.
 *
 * Key principles:
 * - AI can NEVER initiate payments
 * - All payments require human approval
 * - Amount thresholds trigger additional verification
 * - Rate limits prevent abuse
 *
 * @security Phase 5.3 - Payment Integration Security
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

/**
 * Payment security rules - these are IMMUTABLE security policies
 */
export const PAYMENT_SECURITY_RULES = {
  // AI restrictions (absolute - cannot be overridden)
  ai_can_initiate_payment: false,
  ai_can_initiate_refund: false,
  ai_can_modify_payment: false,

  // Automation restrictions
  auto_payment_allowed: false,
  auto_refund_allowed: false,

  // Human approval requirements
  approval_required_for_all_payments: true,
  approval_required_for_refunds: true,

  // Amount thresholds (in USD)
  two_factor_threshold_usd: 100,
  admin_approval_threshold_usd: 1000,
  multi_approval_threshold_usd: 5000,

  // Rate limits
  max_transactions_per_hour: 20,
  max_amount_per_hour_usd: 10000,
  max_transactions_per_day: 100,
  max_amount_per_day_usd: 50000,

  // Monitoring
  alert_on_unusual_amount: true,
  unusual_amount_multiplier: 3, // 3x average
  alert_on_unusual_time: true,
  business_hours: { start: 8, end: 18 },
};

/**
 * Payment request type
 */
export interface PaymentRequest {
  amount_usd: number;
  type: 'payment' | 'refund' | 'transfer';
  recipient?: string;
  description?: string;
}

/**
 * Request context for validation
 */
export interface RequestContext {
  source: 'user' | 'ai' | 'automation' | 'api';
  user_id: string;
  two_factor_verified?: boolean;
  user_role?: 'member' | 'admin' | 'owner';
  ip_address?: string;
  timestamp?: number;
}

/**
 * Payment validation result
 */
export interface PaymentValidationResult {
  approved: boolean;
  violations: string[];
  requires_additional_approval: boolean;
  alerts_triggered?: string[];
}

/**
 * Hourly payment statistics
 */
export interface HourlyPaymentStats {
  count: number;
  total_usd: number;
}

// In-memory stats store (in production, use persistent storage)
const hourlyStats: Map<string, HourlyPaymentStats> = new Map();
const dailyStats: Map<string, HourlyPaymentStats> = new Map();
const userAverages: Map<string, number> = new Map();

// Alert log
interface PaymentAlert {
  timestamp: string;
  type: 'unusual_amount' | 'unusual_time' | 'rate_limit' | 'threshold_exceeded';
  user_id: string;
  amount_usd: number;
  details: string;
}

const alertLog: PaymentAlert[] = [];

/**
 * Get hourly payment stats for a user
 */
export async function getHourlyPaymentStats(userId: string): Promise<HourlyPaymentStats> {
  const key = `${userId}-${new Date().getHours()}`;
  return hourlyStats.get(key) || { count: 0, total_usd: 0 };
}

/**
 * Get daily payment stats for a user
 */
export async function getDailyPaymentStats(userId: string): Promise<HourlyPaymentStats> {
  const key = `${userId}-${new Date().toISOString().split('T')[0]}`;
  return dailyStats.get(key) || { count: 0, total_usd: 0 };
}

/**
 * Get average transaction amount for a user
 */
export async function getAverageTransactionAmount(userId: string): Promise<number> {
  return userAverages.get(userId) || 100; // Default to $100 if no history
}

/**
 * Record a payment for stats tracking
 */
export function recordPaymentStats(userId: string, amountUsd: number): void {
  // Update hourly stats
  const hourKey = `${userId}-${new Date().getHours()}`;
  const hourlyData = hourlyStats.get(hourKey) || { count: 0, total_usd: 0 };
  hourlyData.count++;
  hourlyData.total_usd += amountUsd;
  hourlyStats.set(hourKey, hourlyData);

  // Update daily stats
  const dayKey = `${userId}-${new Date().toISOString().split('T')[0]}`;
  const dailyData = dailyStats.get(dayKey) || { count: 0, total_usd: 0 };
  dailyData.count++;
  dailyData.total_usd += amountUsd;
  dailyStats.set(dayKey, dailyData);

  // Update average (simple moving average)
  const currentAvg = userAverages.get(userId) || amountUsd;
  const newAvg = (currentAvg + amountUsd) / 2;
  userAverages.set(userId, newAvg);
}

/**
 * Alert for unusual payment
 */
export async function alertUnusualPayment(
  request: PaymentRequest,
  context: RequestContext
): Promise<void> {
  alertLog.push({
    timestamp: new Date().toISOString(),
    type: 'unusual_amount',
    user_id: context.user_id,
    amount_usd: request.amount_usd,
    details: `Amount ${request.amount_usd} is unusual for user ${context.user_id}`,
  });
}

/**
 * Validate a payment request against security rules
 */
export async function validatePaymentRequest(
  request: PaymentRequest,
  context: RequestContext
): Promise<PaymentValidationResult> {
  const violations: string[] = [];
  const alerts: string[] = [];

  // 1. Source check - AI CANNOT initiate payments
  if (context.source === 'ai') {
    violations.push('AI cannot initiate payments');
  }

  // 2. Automation check
  if (context.source === 'automation') {
    if (request.type === 'payment' && !PAYMENT_SECURITY_RULES.auto_payment_allowed) {
      violations.push('Automated payments not allowed');
    }
    if (request.type === 'refund' && !PAYMENT_SECURITY_RULES.auto_refund_allowed) {
      violations.push('Automated refunds not allowed');
    }
  }

  // 3. Two-factor authentication check
  if (request.amount_usd >= PAYMENT_SECURITY_RULES.two_factor_threshold_usd) {
    if (!context.two_factor_verified) {
      violations.push('2FA required for this amount');
    }
  }

  // 4. Admin approval check
  if (request.amount_usd >= PAYMENT_SECURITY_RULES.admin_approval_threshold_usd) {
    if (context.user_role !== 'admin' && context.user_role !== 'owner') {
      violations.push('Admin approval required for this amount');
    }
  }

  // 5. Rate limits - hourly transactions
  const hourlyStats = await getHourlyPaymentStats(context.user_id);
  if (hourlyStats.count >= PAYMENT_SECURITY_RULES.max_transactions_per_hour) {
    violations.push('Hourly transaction limit exceeded');
    alerts.push('rate_limit_hourly_count');
  }

  // 6. Rate limits - hourly amount
  if (hourlyStats.total_usd + request.amount_usd > PAYMENT_SECURITY_RULES.max_amount_per_hour_usd) {
    violations.push('Hourly amount limit exceeded');
    alerts.push('rate_limit_hourly_amount');
  }

  // 7. Rate limits - daily transactions
  const dailyStats = await getDailyPaymentStats(context.user_id);
  if (dailyStats.count >= PAYMENT_SECURITY_RULES.max_transactions_per_day) {
    violations.push('Daily transaction limit exceeded');
    alerts.push('rate_limit_daily_count');
  }

  // 8. Rate limits - daily amount
  if (dailyStats.total_usd + request.amount_usd > PAYMENT_SECURITY_RULES.max_amount_per_day_usd) {
    violations.push('Daily amount limit exceeded');
    alerts.push('rate_limit_daily_amount');
  }

  // 9. Anomaly detection - unusual amount
  if (PAYMENT_SECURITY_RULES.alert_on_unusual_amount) {
    const avgTransaction = await getAverageTransactionAmount(context.user_id);
    if (request.amount_usd > avgTransaction * PAYMENT_SECURITY_RULES.unusual_amount_multiplier) {
      await alertUnusualPayment(request, context);
      alerts.push('unusual_amount');
    }
  }

  // 10. Anomaly detection - unusual time
  if (PAYMENT_SECURITY_RULES.alert_on_unusual_time) {
    const hour = new Date().getHours();
    if (hour < PAYMENT_SECURITY_RULES.business_hours.start ||
        hour >= PAYMENT_SECURITY_RULES.business_hours.end) {
      alerts.push('unusual_time');
    }
  }

  return {
    approved: violations.length === 0,
    violations,
    requires_additional_approval: request.amount_usd >= PAYMENT_SECURITY_RULES.admin_approval_threshold_usd,
    alerts_triggered: alerts.length > 0 ? alerts : undefined,
  };
}

/**
 * Get payment alerts
 */
export function getPaymentAlerts(userId?: string, limit?: number): PaymentAlert[] {
  let alerts = alertLog;

  if (userId) {
    alerts = alerts.filter((a) => a.user_id === userId);
  }

  if (limit) {
    alerts = alerts.slice(-limit);
  }

  return alerts;
}

/**
 * Clear payment stats (for testing)
 */
export function clearPaymentStats(): void {
  hourlyStats.clear();
  dailyStats.clear();
  userAverages.clear();
  alertLog.length = 0;
}

/**
 * Set user average for testing
 */
export function setUserAverage(userId: string, average: number): void {
  userAverages.set(userId, average);
}

/**
 * Set hourly stats for testing
 */
export function setHourlyStats(userId: string, stats: HourlyPaymentStats): void {
  const key = `${userId}-${new Date().getHours()}`;
  hourlyStats.set(key, stats);
}

export default {
  PAYMENT_SECURITY_RULES,
  validatePaymentRequest,
  getHourlyPaymentStats,
  getDailyPaymentStats,
  getAverageTransactionAmount,
  recordPaymentStats,
  alertUnusualPayment,
  getPaymentAlerts,
  clearPaymentStats,
  setUserAverage,
  setHourlyStats,
};
