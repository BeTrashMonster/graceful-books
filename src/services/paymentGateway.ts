/**
 * Payment Gateway Service
 *
 * Provides payment processing integration with:
 * - Stripe payment gateway
 * - Square payment gateway
 * - Manual payment recording
 *
 * Requirements:
 * - H4: Client Portal
 * - Secure payment processing
 * - Payment status tracking
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import type { DatabaseResult } from '../store/types';
import type { Payment, PaymentGateway, PaymentStatus } from '../db/schema/payments.schema';
import { createDefaultPayment, validatePayment } from '../db/schema/payments.schema';
import { getDeviceId } from '../utils/device';
import { incrementVersionVector } from '../db/crdt';
import { ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import { markInvoicePaid } from '../store/invoices';

const paymentLogger = logger.child('PaymentGateway');

/**
 * Payment gateway configuration
 */
export interface PaymentGatewayConfig {
  gateway: PaymentGateway;
  apiKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  testMode?: boolean;
}

/**
 * Payment intent creation result
 */
export interface PaymentIntentResult {
  paymentId: string;
  clientSecret?: string; // For Stripe
  checkoutUrl?: string; // For Square
  gatewayTransactionId: string;
}

/**
 * Payment method details
 */
export interface PaymentMethodDetails {
  type: string; // 'card', 'ach', 'bank_transfer', etc.
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

/**
 * Initialize payment gateway
 * In production, this would load Stripe.js or Square Web SDK
 */
export async function initializeGateway(
  config: PaymentGatewayConfig
): Promise<DatabaseResult<void>> {
  try {
    if (config.gateway === 'STRIPE') {
      // In production, load Stripe.js
      // const stripe = await loadStripe(config.publishableKey!);
      paymentLogger.info('Stripe gateway initialized (mock)', { testMode: config.testMode });
    } else if (config.gateway === 'SQUARE') {
      // In production, load Square Web SDK
      // const payments = Square.payments(config.apiKey!, config.testMode);
      paymentLogger.info('Square gateway initialized (mock)', { testMode: config.testMode });
    }

    return { success: true, data: undefined };
  } catch (error) {
    paymentLogger.error('Failed to initialize payment gateway', { error, gateway: config.gateway });
    return {
      success: false,
      error: {
        code: ErrorCode.CONFIGURATION_ERROR,
        message: `Failed to initialize ${config.gateway} gateway`,
        details: error,
      },
    };
  }
}

/**
 * Create a payment intent
 */
export async function createPaymentIntent(
  companyId: string,
  invoiceId: string,
  portalTokenId: string,
  gateway: PaymentGateway,
  amount: string,
  currency: string,
  customerEmail: string,
  customerName?: string
): Promise<DatabaseResult<PaymentIntentResult>> {
  try {
    // Verify invoice exists and get amount
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Invoice not found: ${invoiceId}`,
        },
      };
    }

    // Create payment record
    const deviceId = getDeviceId();
    const payment: Payment = {
      id: nanoid(),
      ...createDefaultPayment(
        companyId,
        invoiceId,
        portalTokenId,
        gateway,
        amount,
        currency,
        customerEmail,
        deviceId
      ),
      customer_name: customerName || null,
      status: 'pending',
    };

    // Validate
    const errors = validatePayment(payment);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Payment validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Store in database
    await db.payments.add(payment);

    // Generate gateway-specific payment intent
    let gatewayTransactionId: string;
    let clientSecret: string | undefined;
    let checkoutUrl: string | undefined;

    if (gateway === 'STRIPE') {
      // In production, create Stripe PaymentIntent
      // const intent = await stripe.paymentIntents.create({ ... });
      gatewayTransactionId = `pi_mock_${nanoid()}`;
      clientSecret = `${gatewayTransactionId}_secret_${nanoid()}`;

      paymentLogger.info('Created Stripe payment intent (mock)', {
        paymentId: payment.id,
        amount,
        currency,
      });
    } else if (gateway === 'SQUARE') {
      // In production, create Square payment
      // const result = await squareClient.paymentsApi.createPayment({ ... });
      gatewayTransactionId = `sq_mock_${nanoid()}`;
      checkoutUrl = `/portal/checkout/${payment.id}`;

      paymentLogger.info('Created Square payment (mock)', {
        paymentId: payment.id,
        amount,
        currency,
      });
    } else {
      // Manual payment
      gatewayTransactionId = `manual_${nanoid()}`;

      paymentLogger.info('Created manual payment record', {
        paymentId: payment.id,
        amount,
        currency,
      });
    }

    // Update payment with gateway transaction ID
    await db.payments.update(payment.id, {
      gateway_transaction_id: gatewayTransactionId,
      status: 'PROCESSING' as PaymentStatus,
      updated_at: Date.now(),
      version_vector: incrementVersionVector(payment.version_vector, deviceId),
    });

    return {
      success: true,
      data: {
        paymentId: payment.id,
        clientSecret,
        checkoutUrl,
        gatewayTransactionId,
      },
    };
  } catch (error) {
    paymentLogger.error('Failed to create payment intent', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Confirm payment completion
 */
export async function confirmPayment(
  paymentId: string,
  paymentMethodDetails?: PaymentMethodDetails
): Promise<DatabaseResult<Payment>> {
  try {
    const payment = await db.payments.get(paymentId);

    if (!payment) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Payment not found: ${paymentId}`,
        },
      };
    }

    if (payment.status === 'SUCCEEDED') {
      return { success: true, data: payment };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    // Update payment status
    await db.payments.update(paymentId, {
      status: 'SUCCEEDED' as PaymentStatus,
      paid_at: now,
      payment_method_type: paymentMethodDetails?.type || null,
      payment_method_last4: paymentMethodDetails?.last4 || null,
      updated_at: now,
      version_vector: incrementVersionVector(payment.version_vector, deviceId),
    });

    // Mark invoice as paid
    await markInvoicePaid(payment.invoice_id, now);

    const updatedPayment = await db.payments.get(paymentId);

    paymentLogger.info('Payment confirmed successfully', {
      paymentId,
      invoiceId: payment.invoice_id,
      amount: payment.amount,
    });

    return { success: true, data: updatedPayment! };
  } catch (error) {
    paymentLogger.error('Failed to confirm payment', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Mark payment as failed
 */
export async function failPayment(
  paymentId: string,
  errorMessage: string
): Promise<DatabaseResult<Payment>> {
  try {
    const payment = await db.payments.get(paymentId);

    if (!payment) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Payment not found: ${paymentId}`,
        },
      };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.payments.update(paymentId, {
      status: 'FAILED' as PaymentStatus,
      error_message: errorMessage,
      updated_at: now,
      version_vector: incrementVersionVector(payment.version_vector, deviceId),
    });

    const updatedPayment = await db.payments.get(paymentId);

    paymentLogger.warn('Payment failed', {
      paymentId,
      invoiceId: payment.invoice_id,
      error: errorMessage,
    });

    return { success: true, data: updatedPayment! };
  } catch (error) {
    paymentLogger.error('Failed to update payment status', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Refund a payment
 */
export async function refundPayment(
  paymentId: string,
  amount?: string
): Promise<DatabaseResult<Payment>> {
  try {
    const payment = await db.payments.get(paymentId);

    if (!payment) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Payment not found: ${paymentId}`,
        },
      };
    }

    if (payment.status !== 'SUCCEEDED') {
      return {
        success: false,
        error: {
          code: ErrorCode.CONSTRAINT_VIOLATION,
          message: 'Can only refund successful payments',
        },
      };
    }

    const refundAmount = amount || payment.amount;

    // In production, process refund through gateway
    if (payment.gateway === 'STRIPE') {
      // await stripe.refunds.create({ payment_intent: payment.gateway_transaction_id });
      paymentLogger.info('Processed Stripe refund (mock)', { paymentId, amount: refundAmount });
    } else if (payment.gateway === 'SQUARE') {
      // await squareClient.refundsApi.refundPayment({ ... });
      paymentLogger.info('Processed Square refund (mock)', { paymentId, amount: refundAmount });
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.payments.update(paymentId, {
      status: 'REFUNDED' as PaymentStatus,
      refunded_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(payment.version_vector, deviceId),
    });

    const updatedPayment = await db.payments.get(paymentId);

    paymentLogger.info('Payment refunded', {
      paymentId,
      invoiceId: payment.invoice_id,
      amount: refundAmount,
    });

    return { success: true, data: updatedPayment! };
  } catch (error) {
    paymentLogger.error('Failed to refund payment', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get payments for an invoice
 */
export async function getInvoicePayments(
  companyId: string,
  invoiceId: string
): Promise<DatabaseResult<Payment[]>> {
  try {
    const payments = await db.payments
      .where('[company_id+invoice_id]')
      .equals([companyId, invoiceId])
      .and((p) => !p.deleted_at)
      .toArray();

    return { success: true, data: payments };
  } catch (error) {
    paymentLogger.error('Failed to get invoice payments', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get payment by ID
 */
export async function getPayment(paymentId: string): Promise<DatabaseResult<Payment>> {
  try {
    const payment = await db.payments.get(paymentId);

    if (!payment || payment.deleted_at) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Payment not found: ${paymentId}`,
        },
      };
    }

    return { success: true, data: payment };
  } catch (error) {
    paymentLogger.error('Failed to get payment', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Process webhook from payment gateway
 * In production, this would verify webhook signatures and process events
 */
export async function processWebhook(
  gateway: PaymentGateway,
  webhookData: unknown
): Promise<DatabaseResult<void>> {
  try {
    // In production, verify webhook signature
    // For Stripe: stripe.webhooks.constructEvent(body, signature, secret)
    // For Square: Square.webhooks.verify(...)

    paymentLogger.info('Processing webhook (mock)', { gateway, webhookData });

    // Parse webhook event and update payment status accordingly
    // This is a mock implementation

    return { success: true, data: undefined };
  } catch (error) {
    paymentLogger.error('Failed to process webhook', { error, gateway });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}
