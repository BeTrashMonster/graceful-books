/**
 * Portal Service Unit Tests
 *
 * Tests for:
 * - Token generation (64-character cryptographically secure)
 * - Token validation and expiration
 * - Rate limiting (100 requests/hour per IP)
 * - Token revocation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../db/database';
import {
  createPortalToken,
  validateToken,
  revokeToken,
  getInvoicePortalTokens,
  cleanupExpiredTokens,
  generatePortalUrl,
  getRateLimitStatus,
} from './portalService';
import { nanoid } from 'nanoid';

describe('PortalService', () => {
  const mockCompanyId = nanoid();
  const mockInvoiceId = nanoid();
  const mockEmail = 'customer@example.com';
  const mockIp = '192.168.1.1';

  beforeEach(async () => {
    // Initialize database
    await db.open();

    // Create a mock invoice
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
  });

  afterEach(async () => {
    // Clean up database
    await db.delete();
  });

  describe('createPortalToken', () => {
    it('should create a portal token with 64-character token', async () => {
      const result = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.token).toHaveLength(64);
      expect(result.data?.email).toBe(mockEmail);
      expect(result.data?.company_id).toBe(mockCompanyId);
      expect(result.data?.invoice_id).toBe(mockInvoiceId);
    });

    it('should set expiration to 90 days from creation', async () => {
      const before = Date.now();
      const result = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      const after = Date.now();

      expect(result.success).toBe(true);

      const expectedExpiry = 90 * 24 * 60 * 60 * 1000;
      const actualExpiry = result.data!.expires_at - result.data!.created_at;

      // Allow for some milliseconds of test execution time
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should reuse existing valid token for same invoice and email', async () => {
      const result1 = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      const result2 = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.id).toBe(result2.data?.id);
      expect(result1.data?.token).toBe(result2.data?.token);
    });

    it('should fail for non-existent invoice', async () => {
      const result = await createPortalToken(mockCompanyId, 'non-existent-id', mockEmail);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should fail if invoice belongs to different company', async () => {
      const result = await createPortalToken('different-company-id', mockInvoiceId, mockEmail);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      const validateResult = await validateToken(createResult.data!.token, mockIp);

      expect(validateResult.success).toBe(true);
      expect(validateResult.data?.token.id).toBe(createResult.data!.id);
      expect(validateResult.data?.invoice.id).toBe(mockInvoiceId);
    });

    it('should increment access count on validation', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      const initialAccessCount = createResult.data!.access_count;

      await validateToken(createResult.data!.token, mockIp);
      await validateToken(createResult.data!.token, mockIp);

      const updatedToken = await db.portalTokens.get(createResult.data!.id);
      expect(updatedToken?.access_count).toBe(initialAccessCount + 2);
    });

    it('should update last_accessed_at timestamp', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);
      expect(createResult.data!.last_accessed_at).toBeNull();

      const before = Date.now();
      await validateToken(createResult.data!.token, mockIp);
      const after = Date.now();

      const updatedToken = await db.portalTokens.get(createResult.data!.id);
      expect(updatedToken?.last_accessed_at).toBeGreaterThanOrEqual(before);
      expect(updatedToken?.last_accessed_at).toBeLessThanOrEqual(after);
    });

    it('should fail for non-existent token', async () => {
      const result = await validateToken('non-existent-token-12345678901234567890123456789012345678901234', mockIp);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should fail for expired token', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      // Manually expire the token
      await db.portalTokens.update(createResult.data!.id, {
        expires_at: Date.now() - 1000, // 1 second ago
      });

      const validateResult = await validateToken(createResult.data!.token, mockIp);

      expect(validateResult.success).toBe(false);
      expect(validateResult.error?.code).toBe('SESSION_INVALID');
    });

    it('should fail for revoked token', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      await revokeToken(createResult.data!.id);

      const validateResult = await validateToken(createResult.data!.token, mockIp);

      expect(validateResult.success).toBe(false);
      expect(validateResult.error?.code).toBe('SESSION_INVALID');
    });

    it('should enforce rate limiting at 100 requests/hour', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      const testIp = '10.0.0.1';

      // Make 100 requests (should all succeed)
      for (let i = 0; i < 100; i++) {
        const result = await validateToken(createResult.data!.token, testIp);
        expect(result.success).toBe(true);
      }

      // 101st request should be rate limited
      const rateLimitedResult = await validateToken(createResult.data!.token, testIp);
      expect(rateLimitedResult.success).toBe(false);
      expect(rateLimitedResult.error?.code).toBe('RATE_LIMITED');
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      const revokeResult = await revokeToken(createResult.data!.id);
      expect(revokeResult.success).toBe(true);

      const token = await db.portalTokens.get(createResult.data!.id);
      expect(token?.revoked_at).toBeTruthy();
    });

    it('should be idempotent (revoking twice is safe)', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      await revokeToken(createResult.data!.id);
      const result = await revokeToken(createResult.data!.id);

      expect(result.success).toBe(true);
    });

    it('should fail for non-existent token', async () => {
      const result = await revokeToken('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getInvoicePortalTokens', () => {
    it('should get all tokens for an invoice', async () => {
      await createPortalToken(mockCompanyId, mockInvoiceId, 'customer1@example.com');
      await createPortalToken(mockCompanyId, mockInvoiceId, 'customer2@example.com');

      const result = await getInvoicePortalTokens(mockCompanyId, mockInvoiceId);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });

    it('should not return deleted tokens', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      // Soft delete the token
      await db.portalTokens.update(createResult.data!.id, {
        deleted_at: Date.now(),
      });

      const result = await getInvoicePortalTokens(mockCompanyId, mockInvoiceId);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(0);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      // Manually expire the token
      await db.portalTokens.update(createResult.data!.id, {
        expires_at: Date.now() - 1000,
      });

      const cleanupResult = await cleanupExpiredTokens();

      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.data).toBe(1);

      const token = await db.portalTokens.get(createResult.data!.id);
      expect(token?.deleted_at).toBeTruthy();
    });

    it('should not delete valid tokens', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      const cleanupResult = await cleanupExpiredTokens();

      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.data).toBe(0);

      const token = await db.portalTokens.get(createResult.data!.id);
      expect(token?.deleted_at).toBeNull();
    });
  });

  describe('generatePortalUrl', () => {
    it('should generate a valid URL', () => {
      const token = 'test-token-1234567890123456789012345678901234567890123456789012';
      const url = generatePortalUrl(token, 'https://example.com');

      expect(url).toBe('https://example.com/portal/test-token-1234567890123456789012345678901234567890123456789012');
    });

    it('should use window.location.origin by default', () => {
      const token = 'test-token-1234567890123456789012345678901234567890123456789012';

      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://app.gracefulbooks.com' },
        writable: true,
      });

      const url = generatePortalUrl(token);

      expect(url).toBe('https://app.gracefulbooks.com/portal/test-token-1234567890123456789012345678901234567890123456789012');
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return correct status for new IP', () => {
      const status = getRateLimitStatus('10.0.0.2');

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(100);
      expect(status.resetAt).toBeGreaterThan(Date.now());
    });

    it('should track remaining requests', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      const testIp = '10.0.0.3';

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await validateToken(createResult.data!.token, testIp);
      }

      const status = getRateLimitStatus(testIp);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(90);
    });

    it('should show not allowed when limit reached', async () => {
      const createResult = await createPortalToken(mockCompanyId, mockInvoiceId, mockEmail);
      expect(createResult.success).toBe(true);

      const testIp = '10.0.0.4';

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await validateToken(createResult.data!.token, testIp);
      }

      const status = getRateLimitStatus(testIp);

      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });
  });
});
