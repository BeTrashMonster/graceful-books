/**
 * Billing Types
 *
 * Types for Stripe billing infrastructure (IC2)
 * Supports advisor-based pricing with client tiers and team member billing
 */

/**
 * User subscription types
 */
export type SubscriptionType = 'individual' | 'advisor' | 'archived';

/**
 * Subscription status from Stripe
 */
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing';

/**
 * Billing tier for advisors
 */
export type BillingTier = 'free' | 'tier_1' | 'tier_2' | 'tier_3' | 'custom';

/**
 * Advisor-client relationship status
 */
export type RelationshipStatus =
  | 'pending_invitation'
  | 'active'
  | 'removed'
  | 'transferred';

/**
 * Team member status
 */
export type TeamMemberStatus =
  | 'pending_invitation'
  | 'active'
  | 'deactivated';

/**
 * Team member role
 */
export type TeamMemberRole =
  | 'senior_accountant'
  | 'junior_accountant'
  | 'bookkeeper'
  | 'tax_preparer'
  | 'admin'
  | 'custom';

/**
 * Payment method type
 */
export type PaymentMethodType = 'card' | 'bank_account' | 'other';

/**
 * Invoice status
 */
export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

/**
 * Subscription entity stored in database
 */
export interface Subscription {
  id: string;
  user_id: string;
  company_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  subscription_type: SubscriptionType;
  status: SubscriptionStatus;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  trial_start: number | null;
  trial_end: number | null;

  // Billing amounts (in cents)
  client_charge: number; // Advisor client tier charge
  team_member_charge: number; // Team member overage charge
  charity_contribution: number; // $5 charity (informational)
  total_amount: number; // Total monthly amount

  // Metadata
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Advisor-client relationship (from J7 data model)
 */
export interface AdvisorClient {
  id: string;
  advisor_id: string;
  client_uuid: string; // Anonymous UUID (hashed from email client-side)
  relationship_status: RelationshipStatus;

  // Invitation tracking
  invitation_sent_at: number | null;
  invitation_accepted_at: number | null;
  invitation_token: string | null;

  // Billing tracking
  billing_started_at: number | null;
  billing_ended_at: number | null;

  // Transfer tracking
  previous_advisor_id: string | null;
  transferred_at: number | null;

  // Audit fields
  created_at: number;
  updated_at: number;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: number | null;
}

/**
 * Advisor team member (from J7 data model)
 */
export interface AdvisorTeamMember {
  id: string;
  advisor_id: string;
  team_member_user_id: string;
  role: TeamMemberRole;
  custom_role_name: string | null;
  status: TeamMemberStatus;

  // Invitation tracking
  invitation_sent_at: number | null;
  invitation_accepted_at: number | null;
  invitation_token: string | null;

  // Audit fields
  created_at: number;
  updated_at: number;
  created_by: string | null;
  deleted_at: number | null;
}

/**
 * Payment method entity
 */
export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  type: PaymentMethodType;

  // Card details (if type is 'card')
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;

  // Bank account details (if type is 'bank_account')
  bank_name: string | null;
  bank_last4: string | null;

  is_default: boolean;

  // Metadata
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Invoice entity
 */
export interface BillingInvoice {
  id: string;
  user_id: string;
  stripe_invoice_id: string;
  stripe_customer_id: string;
  subscription_id: string | null;

  status: InvoiceStatus;
  amount_due: number; // in cents
  amount_paid: number; // in cents
  currency: string;

  // Dates
  created_at: number;
  due_date: number | null;
  paid_at: number | null;
  voided_at: number | null;

  // URLs
  invoice_pdf_url: string | null;
  hosted_invoice_url: string | null;

  // Metadata
  description: string | null;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Billing calculation result
 */
export interface BillingCalculation {
  clientCount: number;
  clientCharge: number;
  teamMemberCount: number;
  teamMemberCharge: number;
  charityContribution: number; // Informational only
  totalMonthlyCost: number;
  perClientCost: number;
  tier: BillingTier;
  tierDescription: string;
}

/**
 * Stripe webhook event
 */
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: any;
  created_at: number;
  processed_at: number | null;
  error: string | null;
}

/**
 * Subscription creation parameters
 */
export interface CreateSubscriptionParams {
  userId: string;
  companyId: string;
  subscriptionType: SubscriptionType;
  paymentMethodId: string;
  trialDays?: number;
}

/**
 * Subscription update parameters
 */
export interface UpdateSubscriptionParams {
  subscriptionId: string;
  clientCount?: number;
  teamMemberCount?: number;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Payment method creation parameters
 */
export interface CreatePaymentMethodParams {
  userId: string;
  stripePaymentMethodId: string;
  setAsDefault?: boolean;
}

/**
 * Billing tier configuration
 */
export interface BillingTierConfig {
  tier: BillingTier;
  minClients: number;
  maxClients: number;
  price: number; // in cents
  description: string;
}

/**
 * Pricing constants
 */
export const PRICING = {
  INDIVIDUAL_MONTHLY: 4000, // $40/month (includes $5 charity)
  ADVISOR_TIER_1: 5000, // $50/month for 4-50 clients
  ADVISOR_TIER_2: 10000, // $100/month for 51-100 clients
  ADVISOR_TIER_3: 15000, // $150/month for 101-150 clients
  ADVISOR_BLOCK_SIZE: 50, // $50 per 50 clients
  TEAM_MEMBER_PRICE: 250, // $2.50/user/month
  TEAM_MEMBERS_FREE: 5, // First 5 team members free
  CLIENTS_FREE: 3, // First 3 clients free for advisors
  CHARITY_CONTRIBUTION: 500, // $5/month (included in prices above)
  GRACE_PERIOD_DAYS: 7, // Days to retry failed payments
} as const;

/**
 * Billing tier configurations
 */
export const BILLING_TIERS: BillingTierConfig[] = [
  {
    tier: 'free',
    minClients: 0,
    maxClients: 3,
    price: 0,
    description: 'First 3 clients free',
  },
  {
    tier: 'tier_1',
    minClients: 4,
    maxClients: 50,
    price: PRICING.ADVISOR_TIER_1,
    description: '4-50 clients',
  },
  {
    tier: 'tier_2',
    minClients: 51,
    maxClients: 100,
    price: PRICING.ADVISOR_TIER_2,
    description: '51-100 clients',
  },
  {
    tier: 'tier_3',
    minClients: 101,
    maxClients: 150,
    price: PRICING.ADVISOR_TIER_3,
    description: '101-150 clients',
  },
  {
    tier: 'custom',
    minClients: 151,
    maxClients: Infinity,
    price: 0, // Calculated dynamically
    description: '150+ clients',
  },
];

/**
 * Stripe price IDs (set in environment variables)
 */
export interface StripePriceIds {
  individual: string;
  advisor_tier_1: string;
  advisor_tier_2: string;
  advisor_tier_3: string;
  team_member: string;
}

/**
 * Billing error types
 */
export type BillingErrorType =
  | 'payment_failed'
  | 'card_declined'
  | 'insufficient_funds'
  | 'payment_method_invalid'
  | 'subscription_inactive'
  | 'webhook_signature_invalid'
  | 'stripe_api_error'
  | 'unknown';

/**
 * Billing error
 */
export interface BillingError {
  type: BillingErrorType;
  message: string;
  code?: string;
  details?: any;
}

/**
 * Charity payment distribution record (IC2.5)
 */
export interface CharityDistribution {
  id: string;
  month: string; // YYYY-MM
  charity_id: string;
  charity_name: string;
  charity_ein: string;
  total_amount: number; // in cents
  contributor_count: number;
  status: 'pending' | 'sent' | 'confirmed';
  payment_method: 'ach' | 'check' | 'wire' | null;
  sent_at: number | null;
  confirmed_at: number | null;
  created_at: number;
  updated_at: number;
}
