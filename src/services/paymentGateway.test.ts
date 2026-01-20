/**
 * Payment Gateway Service Unit Tests
 *
 * Tests for:
 * - Payment intent creation
 * - Payment confirmation
 * - Payment failure handling
 * - Refund processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/database';
import {
  initializeGateway,
  createPaymentIntent,
  confirmPayment,
  failPayment,
  refundPayment,
  getInvoicePayments,
  getPayment,
} from './paymentGateway';
import { createPortalToken } from './portalService';
import { nanoid } from 'nanoid';

describe('PaymentGateway', () => {
  const mockCompanyId = nanoid();
  const mockInvoiceId = nanoid();
  const mockPortalTokenId = nanoid();
  const mockEmail = 'customer@example.com';

  beforeEach(async () => {
    await db.open();

    // Create mock invoice
    await db.invoices.add({
      id: mockInvoiceId,
      company_id: mockCompanyId,
      customer_id: nanoid(),
      invoice_number: 'INV-2026-0001',
      invoice_date: Date.now(),
      due_date: Date.now() + 30 * 24 * 60 * 60 * 1000,
      status: 'SENT',
      subtotal: '100.00',
      tax: '10.00',
      total: '110.00',
      notes: null,
      internal_memo: null,
      template_id: 'classic',
      line_items: JSON.stringify([]),
      transaction_id: null,
      sent_at: Date.now(),
      paid_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { test: 1 },
    });

    // Create mock portal token
    await db.portalTokens.add({
      id: mockPortalTokenId,
      company_id: mockCompanyId,
      invoice_id: mockInvoiceId,
      token: 'test-token-1234567890123456789012345678901234567890123456789012',
      email: mockEmail,
      created_at: Date.now(),
      expires_at: Date.now() + 90 * 24 * 60 * 60 * 1000,
      last_accessed_at: null,
      access_count: 0,
      revoked_at: null,
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { test: 1 },
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('initializeGateway', () => {
    it('should initialize Stripe gateway', async () => {
      const result = await initializeGateway({
        gateway: 'STRIPE',
        publishableKey: 'pk_test_123',
        testMode: true,
      });

      expect(result.success).toBe(true);
    });

    it('should initialize Square gateway', async () => {
      const result = await initializeGateway({
        gateway: 'SQUARE',
        apiKey: 'sq_test_123',
        testMode: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create a Stripe payment intent', async () => {
      const result = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail,
        'John Doe'
      );

      expect(result.success).toBe(true);
      expect((result as any).data.paymentId).toBeDefined();
      expect((result as any).data.gatewayTransactionId).toBeDefined();
      expect((result as any).data.clientSecret).toBeDefined();
      expect((result as any).data.gatewayTransactionId).toMatch(/^pi_mock_/);
    });

    it('should create a Square payment intent', async () => {
      const result = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'SQUARE',
        '110.00',
        'USD',
        mockEmail
      );

      expect(result.success).toBe(true);
      expect((result as any).data.paymentId).toBeDefined();
      expect((result as any).data.gatewayTransactionId).toBeDefined();
      expect((result as any).data.checkoutUrl).toBeDefined();
      expect((result as any).data.gatewayTransactionId).toMatch(/^sq_mock_/);
    });

    it('should create a manual payment record', async () => {
      const result = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'MANUAL',
        '110.00',
        'USD',
        mockEmail
      );

      expect(result.success).toBe(true);
      expect((result as any).data.paymentId).toBeDefined();
      expect((result as any).data.gatewayTransactionId).toMatch(/^manual_/);
    });

    it('should store payment in database with PROCESSING status', async () => {
      const result = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );

      expect(result.success).toBe(true);

      const payment = await db.payments.get((result as any).data.paymentId);
      expect(payment).toBeDefined();
      expect(payment?.status).toBe('PROCESSING');
      expect(payment?.amount).toBe('110.00');
      expect(payment?.currency).toBe('USD');
      expect(payment?.customer_email).toBe(mockEmail);
    });

    it('should fail for non-existent invoice', async () => {
      const result = await createPaymentIntent(
        mockCompanyId,
        'non-existent-invoice-id',
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });

    it('should validate payment amount', async () => {
      const result = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '-10.00', // Invalid negative amount
        'USD',
        mockEmail
      );

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment and mark invoice as paid', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      const confirmResult = await confirmPayment((intentResult as any).data.paymentId, {
        type: 'card',
        last4: '4242',
        brand: 'Visa',
      });

      expect(confirmResult.success).toBe(true);
      expect((confirmResult as any).data.status).toBe('SUCCEEDED');
      expect((confirmResult as any).data.paid_at).toBeTruthy();
      expect((confirmResult as any).data.payment_method_type).toBe('card');
      expect((confirmResult as any).data.payment_method_last4).toBe('4242');

      // Check invoice is marked as paid
      const invoice = await db.invoices.get(mockInvoiceId);
      expect(invoice?.status).toBe('PAID');
      expect(invoice?.paid_at).toBeTruthy();
    });

    it('should be idempotent (confirming twice is safe)', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      await confirmPayment((intentResult as any).data.paymentId);
      const result = await confirmPayment((intentResult as any).data.paymentId);

      expect(result.success).toBe(true);
      expect((result as any).data.status).toBe('SUCCEEDED');
    });

    it('should fail for non-existent payment', async () => {
      const result = await confirmPayment('non-existent-payment-id');

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });

  describe('failPayment', () => {
    it('should mark payment as failed with error message', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      const failResult = await failPayment(
        (intentResult as any).data.paymentId,
        'Card declined'
      );

      expect(failResult.success).toBe(true);
      expect((failResult as any).data.status).toBe('FAILED');
      expect((failResult as any).data.error_message).toBe('Card declined');
    });

    it('should not mark invoice as paid', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      await failPayment((intentResult as any).data.paymentId, 'Card declined');

      const invoice = await db.invoices.get(mockInvoiceId);
      expect(invoice?.status).not.toBe('PAID');
    });
  });

  describe('refundPayment', () => {
    it('should refund a successful payment', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      await confirmPayment((intentResult as any).data.paymentId);

      const refundResult = await refundPayment((intentResult as any).data.paymentId);

      expect(refundResult.success).toBe(true);
      expect((refundResult as any).data.status).toBe('REFUNDED');
      expect((refundResult as any).data.refunded_at).toBeTruthy();
    });

    it('should support partial refunds', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      await confirmPayment((intentResult as any).data.paymentId);

      const refundResult = await refundPayment((intentResult as any).data.paymentId, '50.00');

      expect(refundResult.success).toBe(true);
      expect((refundResult as any).data.status).toBe('REFUNDED');
    });

    it('should fail to refund non-successful payment', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      const refundResult = await refundPayment((intentResult as any).data.paymentId);

      expect(refundResult.success).toBe(false);
      expect((refundResult as any).error.code).toBe('CONSTRAINT_VIOLATION');
    });
  });

  describe('getInvoicePayments', () => {
    it('should get all payments for an invoice', async () => {
      await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );

      await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'SQUARE',
        '110.00',
        'USD',
        mockEmail
      );

      const result = await getInvoicePayments(mockCompanyId, mockInvoiceId);

      expect(result.success).toBe(true);
      expect((result as any).data.length).toBe(2);
    });

    it('should not return deleted payments', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      // Soft delete the payment
      await db.payments.update((intentResult as any).data.paymentId, {
        deleted_at: Date.now(),
      });

      const result = await getInvoicePayments(mockCompanyId, mockInvoiceId);

      expect(result.success).toBe(true);
      expect((result as any).data.length).toBe(0);
    });
  });

  describe('getPayment', () => {
    it('should get a payment by ID', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      const result = await getPayment((intentResult as any).data.paymentId);

      expect(result.success).toBe(true);
      expect((result as any).data.id).toBe((intentResult as any).data.paymentId);
    });

    it('should fail for non-existent payment', async () => {
      const result = await getPayment('non-existent-id');

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });

    it('should not return deleted payment', async () => {
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        mockPortalTokenId,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      await db.payments.update((intentResult as any).data.paymentId, {
        deleted_at: Date.now(),
      });

      const result = await getPayment((intentResult as any).data.paymentId);

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('NOT_FOUND');
    });
  });
});
