/**
 * Portal and Payment Integration Tests
 *
 * Tests the complete flow:
 * 1. Create portal token for invoice
 * 2. Validate token
 * 3. Create payment intent
 * 4. Confirm payment
 * 5. Invoice marked as paid
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/database';
import { createPortalToken, validateToken } from './portalService';
import { createPaymentIntent, confirmPayment, getInvoicePayments } from './paymentGateway';
import { getInvoice } from '../store/invoices';
import { nanoid } from 'nanoid';

describe('Portal and Payment Integration', () => {
  const mockCompanyId = nanoid();
  const mockCustomerId = nanoid();
  const mockEmail = 'customer@example.com';
  const mockIp = '192.168.1.100';
  let mockInvoiceId: string;

  beforeEach(async () => {
    await db.open();

    // Create a complete invoice with line items
    mockInvoiceId = nanoid();
    await db.invoices.add({
      id: mockInvoiceId,
      company_id: mockCompanyId,
      customer_id: mockCustomerId,
      invoice_number: 'INV-2026-0001',
      invoice_date: Date.now(),
      due_date: Date.now() + 30 * 24 * 60 * 60 * 1000,
      status: 'SENT',
      subtotal: '100.00',
      tax: '10.00',
      total: '110.00',
      notes: 'Thank you for your business!',
      internal_memo: 'Follow up in 30 days',
      template_id: 'classic',
      line_items: JSON.stringify([
        {
          id: nanoid(),
          description: 'Consulting Services',
          quantity: 10,
          unitPrice: '10.00',
          accountId: 'account-123',
          total: '100.00',
        },
      ]),
      transaction_id: null,
      sent_at: Date.now(),
      paid_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { test: 1 },
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Complete Payment Flow', () => {
    it('should complete full payment flow from portal link to payment', async () => {
      // Step 1: Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);
      expect((tokenResult as any).data.token).toHaveLength(64);

      const portalToken = tokenResult.data!;

      // Step 2: Customer validates token
      const validateResult = await validateToken(portalToken.token, mockIp);
      expect(validateResult.success).toBe(true);
      expect((validateResult as any).data.invoice.id).toBe(mockInvoiceId);
      expect((validateResult as any).data.invoice.status).toBe('SENT');
      expect((validateResult as any).data.invoice.total).toBe('110.00');

      // Step 3: Create payment intent
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        portalToken.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail,
        'John Doe'
      );
      expect(intentResult.success).toBe(true);
      expect((intentResult as any).data.clientSecret).toBeDefined();

      // Step 4: Customer completes payment (simulated)
      const confirmResult = await confirmPayment((intentResult as any).data.paymentId, {
        type: 'card',
        last4: '4242',
        brand: 'Visa',
      });
      expect(confirmResult.success).toBe(true);
      expect((confirmResult as any).data.status).toBe('SUCCEEDED');

      // Step 5: Verify invoice is marked as paid
      const invoiceResult = await getInvoice(mockInvoiceId);
      expect(invoiceResult.success).toBe(true);
      expect((invoiceResult as any).data.status).toBe('PAID');
      expect((invoiceResult as any).data.paid_at).toBeTruthy();

      // Step 6: Verify payment is stored
      const paymentsResult = await getInvoicePayments(mockCompanyId, mockInvoiceId);
      expect(paymentsResult.success).toBe(true);
      expect((paymentsResult as any).data.length).toBe(1);
      expect((paymentsResult as any).data[0].status).toBe('SUCCEEDED');
      expect((paymentsResult as any).data[0].amount).toBe('110.00');
    });

    it('should handle failed payment without marking invoice as paid', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      // Validate token
      const validateResult = await validateToken((tokenResult as any).data.token, mockIp);
      expect(validateResult.success).toBe(true);

      // Create payment intent
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        (tokenResult as any).data.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);

      // Payment fails (card declined)
      const payment = await db.payments.get((intentResult as any).data.paymentId);
      await db.payments.update((intentResult as any).data.paymentId, {
        status: 'FAILED',
        error_message: 'Card declined',
        updated_at: Date.now(),
      });

      // Verify invoice is NOT marked as paid
      const invoiceResult = await getInvoice(mockInvoiceId);
      expect(invoiceResult.success).toBe(true);
      expect((invoiceResult as any).data.status).toBe('SENT');
      expect((invoiceResult as any).data.paid_at).toBeNull();
    });

    it('should allow multiple payment attempts for same invoice', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      // First payment attempt fails
      const intent1 = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        (tokenResult as any).data.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      await db.payments.update((intent1 as any).data.paymentId, {
        status: 'FAILED',
        error_message: 'Card declined',
      });

      // Second payment attempt succeeds
      const intent2 = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        (tokenResult as any).data.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      await confirmPayment((intent2 as any).data.paymentId);

      // Verify two payment records exist
      const paymentsResult = await getInvoicePayments(mockCompanyId, mockInvoiceId);
      expect(paymentsResult.success).toBe(true);
      expect((paymentsResult as any).data.length).toBe(2);

      // Verify invoice is paid
      const invoiceResult = await getInvoice(mockInvoiceId);
      expect(invoiceResult.success).toBe(true);
      expect((invoiceResult as any).data.status).toBe('PAID');
    });

    it('should track portal token access during payment flow', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      const initialAccessCount = (tokenResult as any).data.access_count;

      // Customer views invoice multiple times
      await validateToken((tokenResult as any).data.token, mockIp);
      await validateToken((tokenResult as any).data.token, mockIp);
      await validateToken((tokenResult as any).data.token, mockIp);

      // Check access count increased
      const updatedToken = await db.portalTokens.get((tokenResult as any).data.id);
      expect(updatedToken?.access_count).toBe(initialAccessCount + 3);

      // Complete payment
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        (tokenResult as any).data.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      await confirmPayment((intentResult as any).data.paymentId);

      // Access count should still be tracked
      const finalToken = await db.portalTokens.get((tokenResult as any).data.id);
      expect(finalToken?.access_count).toBe(initialAccessCount + 3);
    });

    it('should prevent payment with expired portal token', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      // Manually expire the token
      await db.portalTokens.update((tokenResult as any).data.id, {
        expires_at: Date.now() - 1000,
      });

      // Attempt to validate token should fail
      const validateResult = await validateToken((tokenResult as any).data.token, mockIp);
      expect(validateResult.success).toBe(false);
      expect((validateResult as any).error.code).toBe('SESSION_INVALID');

      // Note: In production, the UI would prevent payment attempts with invalid tokens
      // Here we just verify the token validation fails as expected
    });

    it('should prevent payment with revoked portal token', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      // Revoke the token
      await db.portalTokens.update((tokenResult as any).data.id, {
        revoked_at: Date.now(),
      });

      // Attempt to validate token should fail
      const validateResult = await validateToken((tokenResult as any).data.token, mockIp);
      expect(validateResult.success).toBe(false);
      expect((validateResult as any).error.code).toBe('SESSION_INVALID');
    });

    it('should handle payment for already paid invoice gracefully', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      // First payment succeeds
      const intent1 = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        (tokenResult as any).data.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      await confirmPayment((intent1 as any).data.paymentId);

      // Verify invoice is paid
      const invoiceResult = await getInvoice(mockInvoiceId);
      expect(invoiceResult.success).toBe(true);
      expect((invoiceResult as any).data.status).toBe('PAID');

      // Second payment attempt (customer didn't see update yet)
      // This should still create payment record but invoice is already paid
      const intent2 = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        (tokenResult as any).data.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intent2.success).toBe(true);

      // Both payments exist
      const paymentsResult = await getInvoicePayments(mockCompanyId, mockInvoiceId);
      expect(paymentsResult.success).toBe(true);
      expect((paymentsResult as any).data.length).toBe(2);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should rate limit excessive portal access attempts', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      const testIp = '10.0.0.100';

      // Make 100 valid requests
      for (let i = 0; i < 100; i++) {
        const result = await validateToken((tokenResult as any).data.token, testIp);
        expect(result.success).toBe(true);
      }

      // 101st request should be rate limited
      const rateLimitedResult = await validateToken((tokenResult as any).data.token, testIp);
      expect(rateLimitedResult.success).toBe(false);
      expect((rateLimitedResult as any).error.code).toBe('RATE_LIMITED');
    });

    it('should allow payment creation even after multiple portal views', async () => {
      // Create portal token
      const tokenResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(tokenResult.success).toBe(true);

      // Customer views invoice 50 times (within rate limit)
      for (let i = 0; i < 50; i++) {
        await validateToken((tokenResult as any).data.token, mockIp);
      }

      // Should still be able to create payment
      const intentResult = await createPaymentIntent(
        mockCompanyId,
        mockInvoiceId,
        (tokenResult as any).data.id,
        'STRIPE',
        '110.00',
        'USD',
        mockEmail
      );
      expect(intentResult.success).toBe(true);
    });
  });
});
