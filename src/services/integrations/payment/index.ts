/**
 * Payment Integration Security Module
 *
 * Provides security controls for payment integrations.
 * AI and automated systems CANNOT initiate payments.
 *
 * @security Phase 5.3 - Payment Integration Security
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

export {
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
  type PaymentRequest,
  type RequestContext,
  type PaymentValidationResult,
  type HourlyPaymentStats,
} from './paymentPolicy';
