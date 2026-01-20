/**
 * Duplicate Detection Service Tests
 *
 * Comprehensive tests for duplicate detection logic including fuzzy matching.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/database';
import {
  DuplicateDetectionService,
  createDuplicateDetectionService,
} from './duplicateDetection.service';
import type { DuplicateCheckInput } from './duplicateDetection.service';

describe('DuplicateDetectionService', () => {
  const companyId = 'company-123';
  let service: DuplicateDetectionService;

  beforeEach(async () => {
    // Clear database
    await db.invoices.clear();
    await db.contacts.clear();

    // Create service instance
    service = createDuplicateDetectionService(companyId);
  });

  afterEach(async () => {
    // Clean up
    await db.invoices.clear();
    await db.contacts.clear();
  });

  describe('checkForDuplicates - Invoices', () => {
    beforeEach(async () => {
      // Add a customer
      await db.contacts.add({
        id: 'customer-001',
        company_id: companyId,
        type: 'CUSTOMER',
        name: 'ACME Corporation',
        email: 'billing@acme.com',
        phone: null,
        address: null,
        tax_id: null,
        notes: null,
        active: true,
        balance: '0.00',
        parent_id: null,
        account_type: 'standalone',
        hierarchy_level: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      });

      // Add existing invoice
      await db.invoices.add({
        id: 'inv-001',
        company_id: companyId,
        customer_id: 'customer-001',
        invoice_number: 'INV-2026-0001',
        invoice_date: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
        due_date: Date.now() + 28 * 24 * 60 * 60 * 1000,
        status: 'SENT',
        subtotal: '100.00',
        tax: '8.00',
        total: '108.00',
        notes: 'Monthly consulting services',
        internal_memo: null,
        template_id: 'classic',
        line_items: JSON.stringify([]),
        transaction_id: null,
        sent_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
        paid_at: null,
        created_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      });
    });

    it('should detect exact duplicate invoice', async () => {
      const input: DuplicateCheckInput = {
        description: 'Monthly consulting services',
        amount: '108.00',
        date: Date.now(),
        vendor_customer: 'ACME Corporation',
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.id).toBe('inv-001');
      expect(candidates[0]!.similarity_score).toBeGreaterThan(0.8);
      expect(candidates[0]!.confidence_level).toBeTruthy();
    });

    it('should detect similar invoice with typo', async () => {
      const input: DuplicateCheckInput = {
        description: 'Monthly consultng services', // typo: "consultng"
        amount: '108.00',
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input);

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0]!.similarity_score).toBeGreaterThan(0.7);
    });

    it('should not detect duplicate with different amount', async () => {
      const input: DuplicateCheckInput = {
        description: 'Monthly consulting services',
        amount: '200.00', // Different amount
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input);

      expect(candidates).toHaveLength(0);
    });

    it('should detect duplicate with amount within tolerance', async () => {
      const input: DuplicateCheckInput = {
        description: 'Monthly consulting services',
        amount: '108.50', // Within 1% tolerance
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input, {
        amount_tolerance: 0.01,
      });

      expect(candidates).toHaveLength(1);
    });

    it('should not detect duplicate outside time window', async () => {
      const input: DuplicateCheckInput = {
        description: 'Monthly consulting services',
        amount: '108.00',
        date: Date.now() + 35 * 24 * 60 * 60 * 1000, // 35 days from now
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input, {
        time_window_days: 30,
      });

      expect(candidates).toHaveLength(0);
    });

    it('should respect similarity threshold', async () => {
      const input: DuplicateCheckInput = {
        description: 'Completely different description',
        amount: '108.00',
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input, {
        similarity_threshold: 0.9, // High threshold
      });

      expect(candidates).toHaveLength(0);
    });

    it('should limit results', async () => {
      // Add more invoices
      for (let i = 2; i <= 10; i++) {
        await db.invoices.add({
          id: `inv-00${i}`,
          company_id: companyId,
          customer_id: 'customer-001',
          invoice_number: `INV-2026-000${i}`,
          invoice_date: Date.now() - i * 24 * 60 * 60 * 1000,
          due_date: Date.now() + 28 * 24 * 60 * 60 * 1000,
          status: 'SENT',
          subtotal: '100.00',
          tax: '8.00',
          total: '108.00',
          notes: 'Monthly consulting services',
          internal_memo: null,
          template_id: 'classic',
          line_items: JSON.stringify([]),
          transaction_id: null,
          sent_at: Date.now() - i * 24 * 60 * 60 * 1000,
          paid_at: null,
          created_at: Date.now() - i * 24 * 60 * 60 * 1000,
          updated_at: Date.now() - i * 24 * 60 * 60 * 1000,
          deleted_at: null,
          version_vector: { 'device-1': 1 },
        });
      }

      const input: DuplicateCheckInput = {
        description: 'Monthly consulting services',
        amount: '108.00',
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input, {
        max_results: 3,
      });

      expect(candidates.length).toBeLessThanOrEqual(3);
    });
  });

  describe('quickCheck', () => {
    beforeEach(async () => {
      // Add a customer
      await db.contacts.add({
        id: 'customer-001',
        company_id: companyId,
        type: 'CUSTOMER',
        name: 'Test Customer',
        email: null,
        phone: null,
        address: null,
        tax_id: null,
        notes: null,
        active: true,
        balance: '0.00',
        parent_id: null,
        account_type: 'standalone',
        hierarchy_level: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      });

      // Add recent invoice (within 7 days)
      await db.invoices.add({
        id: 'inv-recent',
        company_id: companyId,
        customer_id: 'customer-001',
        invoice_number: 'INV-2026-0100',
        invoice_date: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
        due_date: Date.now() + 27 * 24 * 60 * 60 * 1000,
        status: 'SENT',
        subtotal: '50.00',
        tax: '4.00',
        total: '54.00',
        notes: 'Web hosting services',
        internal_memo: null,
        template_id: 'classic',
        line_items: JSON.stringify([]),
        transaction_id: null,
        sent_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
        paid_at: null,
        created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      });
    });

    it('should return single best candidate', async () => {
      const input: DuplicateCheckInput = {
        description: 'Web hosting services',
        amount: '54.00',
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidate = await service.quickCheck(input);

      expect(candidate).toBeTruthy();
      expect(candidate?.id).toBe('inv-recent');
      expect(candidate?.similarity_score).toBeGreaterThan(0.85);
    });

    it('should return null if no match', async () => {
      const input: DuplicateCheckInput = {
        description: 'Completely different',
        amount: '54.00',
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidate = await service.quickCheck(input);

      expect(candidate).toBeNull();
    });
  });

  describe('confidence level calculation', () => {
    it('should assign high confidence for very similar + recent', async () => {
      // Add customer
      await db.contacts.add({
        id: 'customer-001',
        company_id: companyId,
        type: 'CUSTOMER',
        name: 'Test Corp',
        email: null,
        phone: null,
        address: null,
        tax_id: null,
        notes: null,
        active: true,
        balance: '0.00',
        parent_id: null,
        account_type: 'standalone',
        hierarchy_level: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      });

      // Add very recent invoice (1 day ago)
      await db.invoices.add({
        id: 'inv-high-conf',
        company_id: companyId,
        customer_id: 'customer-001',
        invoice_number: 'INV-2026-0200',
        invoice_date: Date.now() - 1 * 24 * 60 * 60 * 1000,
        due_date: Date.now() + 29 * 24 * 60 * 60 * 1000,
        status: 'SENT',
        subtotal: '100.00',
        tax: '8.00',
        total: '108.00',
        notes: 'Software license renewal',
        internal_memo: null,
        template_id: 'classic',
        line_items: JSON.stringify([]),
        transaction_id: null,
        sent_at: Date.now() - 1 * 24 * 60 * 60 * 1000,
        paid_at: null,
        created_at: Date.now() - 1 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 1 * 24 * 60 * 60 * 1000,
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      });

      const input: DuplicateCheckInput = {
        description: 'Software license renewal',
        amount: '108.00',
        date: Date.now(),
        entity_type: 'INVOICE',
      };

      const candidates = await service.checkForDuplicates(input);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.confidence_level).toBe('high');
    });
  });

  describe('formatDuplicateMessage', () => {
    it('should format message with vendor/customer', () => {
      const candidate = {
        id: 'inv-001',
        entity_type: 'INVOICE' as const,
        description: 'Consulting services',
        amount: '500.00',
        date: Date.now() - 3 * 24 * 60 * 60 * 1000,
        vendor_customer: 'ACME Corp',
        similarity_score: 0.95,
        days_apart: 3,
        confidence_level: 'high' as const,
      };

      const message = service.formatDuplicateMessage(candidate);

      expect(message).toContain('ACME Corp');
      expect(message).toContain('Consulting services');
      expect(message).toContain('500.00');
      expect(message).toContain('3 days ago');
    });

    it('should format message without vendor/customer', () => {
      const candidate = {
        id: 'inv-001',
        entity_type: 'INVOICE' as const,
        description: 'Consulting services',
        amount: '500.00',
        date: Date.now(),
        similarity_score: 0.95,
        days_apart: 0,
        confidence_level: 'high' as const,
      };

      const message = service.formatDuplicateMessage(candidate);

      expect(message).not.toContain('undefined');
      expect(message).toContain('Consulting services');
      expect(message).toContain('today');
    });
  });

  describe('getConfidenceMessage', () => {
    it('should return appropriate message for each confidence level', () => {
      expect(service.getConfidenceMessage('high')).toContain('very likely');
      expect(service.getConfidenceMessage('medium')).toContain('might');
      expect(service.getConfidenceMessage('low')).toContain('could');
    });
  });
});
