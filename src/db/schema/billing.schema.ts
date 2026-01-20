/**
 * Billing Schema Definitions
 *
 * Database schemas for Stripe billing infrastructure (IC2)
 * Includes subscriptions, invoices, advisor clients, team members, and payment methods
 */

/**
 * Subscriptions Schema
 * Stores user subscription information and Stripe subscription details
 */
export const subscriptionsSchema =
  'id, user_id, company_id, stripe_customer_id, stripe_subscription_id, subscription_type, status, current_period_end, deleted_at';

/**
 * Advisor Clients Schema (from J7 data model)
 * Tracks advisor-client relationships for billing
 */
export const advisorClientsSchema =
  'id, advisor_id, client_uuid, relationship_status, [advisor_id+client_uuid], [advisor_id+relationship_status], deleted_at';

/**
 * Advisor Team Members Schema (from J7 data model)
 * Tracks advisor's team members for billing
 */
export const advisorTeamMembersSchema =
  'id, advisor_id, team_member_user_id, status, [advisor_id+status], [advisor_id+team_member_user_id], deleted_at';

/**
 * Payment Methods Schema
 * Stores user payment methods from Stripe
 */
export const paymentMethodsSchema =
  'id, user_id, stripe_payment_method_id, type, is_default, deleted_at';

/**
 * Billing Invoices Schema
 * Stores Stripe invoice data
 */
export const billingInvoicesSchema =
  'id, user_id, stripe_invoice_id, stripe_customer_id, subscription_id, status, created_at, due_date, paid_at, deleted_at';

/**
 * Stripe Webhook Events Schema
 * Stores webhook events for debugging and idempotency
 */
export const stripeWebhookEventsSchema =
  'id, type, created_at, processed_at';

/**
 * Charity Distributions Schema (IC2.5)
 * Tracks charity payment distributions
 */
export const charityDistributionsSchema =
  'id, month, charity_id, status, sent_at, confirmed_at, deleted_at';
