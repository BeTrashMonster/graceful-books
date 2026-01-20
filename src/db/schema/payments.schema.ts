/**
 * Payments Schema Definition
 *
 * Defines the structure for customer payments made through the portal.
 * Tracks payment gateway transactions and links them to invoices.
 *
 * Requirements:
 * - H4: Client Portal
 * - Payment gateway integration (Stripe, Square)
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { VersionVector } from '../../types/database.types';

/**
 * Payment gateway provider
 */
export type PaymentGateway = 'STRIPE' | 'SQUARE' | 'MANUAL';

/**
 * Payment status
 */
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

/**
 * Payment entity
 */
export interface Payment {
  id: string; // UUID
  company_id: string; // Company UUID
  invoice_id: string; // Invoice UUID
  portal_token_id: string; // Portal token used for payment
  gateway: PaymentGateway; // Payment gateway used
  gateway_transaction_id: string | null; // External transaction ID from gateway
  amount: string; // Payment amount as decimal string
  currency: string; // Currency code (e.g., "USD")
  status: PaymentStatus; // Current payment status
  customer_email: string; // Customer email
  customer_name: string | null; // Customer name (from payment form)
  payment_method_type: string | null; // Payment method (e.g., "card", "ach")
  payment_method_last4: string | null; // Last 4 digits of payment method
  error_message: string | null; // ENCRYPTED - Error message if failed
  metadata: string | null; // ENCRYPTED - Additional payment metadata (JSON)
  paid_at: number | null; // Unix timestamp when payment succeeded
  refunded_at: number | null; // Unix timestamp if refunded
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for Payments table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying payments by company
 * - invoice_id: For querying payments by invoice
 * - portal_token_id: For querying payments by portal token
 * - gateway_transaction_id: For quick lookup of external transactions
 * - status: For querying by payment status
 * - [company_id+status]: Compound index for filtered queries
 * - [company_id+invoice_id]: Compound index for invoice payment queries
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const paymentsSchema =
  'id, company_id, invoice_id, portal_token_id, gateway_transaction_id, status, [company_id+status], [company_id+invoice_id], updated_at, deleted_at';

/**
 * Table name constant
 */
export const PAYMENTS_TABLE = 'payments';

/**
 * Default values for new Payment
 */
export const createDefaultPayment = (
  companyId: string,
  invoiceId: string,
  portalTokenId: string,
  gateway: PaymentGateway,
  amount: string,
  currency: string,
  customerEmail: string,
  deviceId: string
): Partial<Payment> => {
  const now = Date.now();

  return {
    company_id: companyId,
    invoice_id: invoiceId,
    portal_token_id: portalTokenId,
    gateway,
    gateway_transaction_id: null,
    amount,
    currency,
    status: 'PENDING',
    customer_email: customerEmail,
    customer_name: null,
    payment_method_type: null,
    payment_method_last4: null,
    error_message: null,
    metadata: null,
    paid_at: null,
    refunded_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure payment has valid fields
 */
export const validatePayment = (payment: Partial<Payment>): string[] => {
  const errors: string[] = [];

  if (!payment.company_id) {
    errors.push('company_id is required');
  }

  if (!payment.invoice_id) {
    errors.push('invoice_id is required');
  }

  if (!payment.portal_token_id) {
    errors.push('portal_token_id is required');
  }

  if (!payment.gateway) {
    errors.push('gateway is required');
  }

  if (!payment.amount) {
    errors.push('amount is required');
  } else {
    const amount = parseFloat(payment.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('amount must be a positive number');
    }
  }

  if (!payment.currency || payment.currency.length !== 3) {
    errors.push('currency must be a 3-letter code (e.g., USD)');
  }

  if (!payment.customer_email || payment.customer_email.trim() === '') {
    errors.push('customer_email is required');
  }

  if (!payment.status) {
    errors.push('status is required');
  }

  return errors;
};

/**
 * Helper: Check if payment is successful
 */
export const isPaymentSuccessful = (payment: Payment): boolean => {
  return payment.status === 'SUCCEEDED';
};

/**
 * Helper: Check if payment is refunded
 */
export const isPaymentRefunded = (payment: Payment): boolean => {
  return payment.status === 'REFUNDED';
};

/**
 * Helper: Check if payment is pending or processing
 */
export const isPaymentInProgress = (payment: Payment): boolean => {
  return payment.status === 'PENDING' || payment.status === 'PROCESSING';
};

/**
 * Helper: Check if payment failed
 */
export const isPaymentFailed = (payment: Payment): boolean => {
  return payment.status === 'FAILED' || payment.status === 'CANCELLED';
};
