/**
 * Retention Policy Service Tests
 *
 * Tests for S7-5: Data Retention Policies implementation.
 * Verifies:
 * - Configurable retention periods
 * - Auto-purge functionality
 * - Secure deletion with data overwrite
 * - 7-year retention enforcement for financial records
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nanoid } from 'nanoid';
import {
  getRetentionPolicies,
  getRetentionPolicy,
  upsertRetentionPolicy,
  deleteRetentionPolicy,
  getRetentionStatistics,
  purgeRecord,
  autoPurgeCompany,
  getDeletionLogs,
} from './retention.service';
import {
  DeletionMethod,
  LEGAL_MINIMUM_RETENTION_DAYS,
  isEligibleForPurge,
  calculateEffectiveRetention,
  requiresLegalRetention,
} from '../types/retention.types';
import { db } from '../store/database';

describe('Retention Policy Types and Helpers', () => {
  describe('requiresLegalRetention', () => {
    it('should identify financial entity types', () => {
      expect(requiresLegalRetention('ACCOUNT')).toBe(true);
      expect(requiresLegalRetention('TRANSACTION')).toBe(true);
      expect(requiresLegalRetention('INVOICE')).toBe(true);
      expect(requiresLegalRetention('BILL')).toBe(true);
      expect(requiresLegalRetention('RECEIPT')).toBe(true);
      expect(requiresLegalRetention('RECONCILIATION')).toBe(true);
      expect(requiresLegalRetention('AUDIT_LOG')).toBe(true);
    });

    it('should identify non-financial entity types', () => {
      expect(requiresLegalRetention('CONTACT')).toBe(false);
      expect(requiresLegalRetention('PRODUCT')).toBe(false);
      expect(requiresLegalRetention('CATEGORY')).toBe(false);
      expect(requiresLegalRetention('TAG')).toBe(false);
    });
  });

  describe('calculateEffectiveRetention', () => {
    it('should return configured days for non-financial entities', () => {
      expect(calculateEffectiveRetention('CONTACT', 30, true)).toBe(30);
      expect(calculateEffectiveRetention('PRODUCT', 90, true)).toBe(90);
    });

    it('should enforce 7-year minimum for financial entities', () => {
      expect(calculateEffectiveRetention('ACCOUNT', 30, true)).toBe(
        LEGAL_MINIMUM_RETENTION_DAYS
      );
      expect(calculateEffectiveRetention('TRANSACTION', 90, true)).toBe(
        LEGAL_MINIMUM_RETENTION_DAYS
      );
    });

    it('should return configured days for financial entities if longer than 7 years', () => {
      const tenYears = 3650;
      expect(calculateEffectiveRetention('ACCOUNT', tenYears, true)).toBe(tenYears);
    });

    it('should not enforce minimum when enforceMinimum is false', () => {
      expect(calculateEffectiveRetention('ACCOUNT', 30, false)).toBe(30);
      expect(calculateEffectiveRetention('TRANSACTION', 90, false)).toBe(90);
    });
  });

  describe('isEligibleForPurge', () => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const sevenYearsAgo = now - LEGAL_MINIMUM_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    it('should return false for null deletedAt', () => {
      expect(isEligibleForPurge(null, 'CONTACT', 30, true)).toBe(false);
    });

    it('should return true for non-financial entities after retention period', () => {
      expect(isEligibleForPurge(ninetyDaysAgo, 'CONTACT', 30, true)).toBe(true);
      expect(isEligibleForPurge(ninetyDaysAgo, 'PRODUCT', 60, true)).toBe(true);
    });

    it('should return false for non-financial entities before retention period', () => {
      expect(isEligibleForPurge(oneDayAgo, 'CONTACT', 30, true)).toBe(false);
      expect(isEligibleForPurge(thirtyDaysAgo, 'PRODUCT', 60, true)).toBe(false);
    });

    it('should enforce 7-year minimum for financial entities', () => {
      expect(isEligibleForPurge(ninetyDaysAgo, 'ACCOUNT', 30, true)).toBe(false);
      expect(isEligibleForPurge(ninetyDaysAgo, 'TRANSACTION', 30, true)).toBe(false);
      expect(isEligibleForPurge(sevenYearsAgo, 'ACCOUNT', 30, true)).toBe(true);
    });

    it('should not enforce minimum when enforceMinimum is false', () => {
      expect(isEligibleForPurge(ninetyDaysAgo, 'ACCOUNT', 30, false)).toBe(true);
      expect(isEligibleForPurge(ninetyDaysAgo, 'TRANSACTION', 30, false)).toBe(true);
    });
  });
});

describe('Retention Policy Service', () => {
  const testCompanyId = 'test-company-' + nanoid();
  const testUserId = 'test-user-' + nanoid();

  beforeEach(async () => {
    // Clear test data
    await db.retention_policies.clear();
    await db.deletion_logs.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    await db.contacts.clear();
  });

  afterEach(async () => {
    // Clean up test data
    await db.retention_policies.clear();
    await db.deletion_logs.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    await db.contacts.clear();
  });

  describe('getRetentionPolicies', () => {
    it('should return empty array when no policies exist', async () => {
      const policies = await getRetentionPolicies(testCompanyId);
      expect(policies).toEqual([]);
    });

    it('should return active policies for company', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);
      await upsertRetentionPolicy(testCompanyId, testUserId, 'PRODUCT', 60, true);

      const policies = await getRetentionPolicies(testCompanyId);
      expect(policies).toHaveLength(2);
      expect(policies.some((p) => p.entity_type === 'CONTACT')).toBe(true);
      expect(policies.some((p) => p.entity_type === 'PRODUCT')).toBe(true);
    });

    it('should not return policies from other companies', async () => {
      const otherCompanyId = 'other-company-' + nanoid();
      await upsertRetentionPolicy(otherCompanyId, testUserId, 'CONTACT', 30, true);

      const policies = await getRetentionPolicies(testCompanyId);
      expect(policies).toHaveLength(0);
    });
  });

  describe('getRetentionPolicy', () => {
    it('should return specific policy for entity type', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);

      const policy = await getRetentionPolicy(testCompanyId, 'CONTACT');
      expect(policy).toBeTruthy();
      expect(policy?.entity_type).toBe('CONTACT');
      expect(policy?.retention_days).toBe(30);
    });

    it('should fall back to ALL policy when specific policy does not exist', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'ALL', 90, true);

      const policy = await getRetentionPolicy(testCompanyId, 'CONTACT');
      expect(policy).toBeTruthy();
      expect(policy?.entity_type).toBe('ALL');
      expect(policy?.retention_days).toBe(90);
    });

    it('should prefer specific policy over ALL policy', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'ALL', 90, true);
      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);

      const policy = await getRetentionPolicy(testCompanyId, 'CONTACT');
      expect(policy?.entity_type).toBe('CONTACT');
      expect(policy?.retention_days).toBe(30);
    });

    it('should return null when no policy exists', async () => {
      const policy = await getRetentionPolicy(testCompanyId, 'CONTACT');
      expect(policy).toBeNull();
    });
  });

  describe('upsertRetentionPolicy', () => {
    it('should create new retention policy', async () => {
      const policy = await upsertRetentionPolicy(
        testCompanyId,
        testUserId,
        'CONTACT',
        30,
        true,
        'Test policy'
      );

      expect(policy.id).toBeTruthy();
      expect(policy.company_id).toBe(testCompanyId);
      expect(policy.entity_type).toBe('CONTACT');
      expect(policy.retention_days).toBe(30);
      expect(policy.enforce_minimum).toBe(true);
      expect(policy.description).toBe('Test policy');
      expect(policy.is_active).toBe(true);
    });

    it('should update existing retention policy', async () => {
      const created = await upsertRetentionPolicy(
        testCompanyId,
        testUserId,
        'CONTACT',
        30,
        true
      );

      const updated = await upsertRetentionPolicy(
        testCompanyId,
        testUserId,
        'CONTACT',
        60,
        false,
        'Updated policy'
      );

      expect(updated.id).toBe(created.id);
      expect(updated.retention_days).toBe(60);
      expect(updated.enforce_minimum).toBe(false);
      expect(updated.description).toBe('Updated policy');
    });

    it('should validate retention days', async () => {
      await expect(
        upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 0, true)
      ).rejects.toThrow();

      await expect(
        upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', -10, true)
      ).rejects.toThrow();
    });
  });

  describe('deleteRetentionPolicy', () => {
    it('should soft delete retention policy', async () => {
      const policy = await upsertRetentionPolicy(
        testCompanyId,
        testUserId,
        'CONTACT',
        30,
        true
      );

      await deleteRetentionPolicy(policy.id, testCompanyId);

      const deleted = await db.retention_policies.get(policy.id);
      expect(deleted?.deleted_at).toBeTruthy();
    });

    it('should not allow deleting policy from different company', async () => {
      const otherCompanyId = 'other-company-' + nanoid();
      const policy = await upsertRetentionPolicy(
        otherCompanyId,
        testUserId,
        'CONTACT',
        30,
        true
      );

      await expect(deleteRetentionPolicy(policy.id, testCompanyId)).rejects.toThrow();
    });
  });

  describe('purgeRecord', () => {
    it('should not purge record that is not soft-deleted', async () => {
      const accountId = nanoid();
      await db.accounts.add({
        id: accountId,
        companyId: testCompanyId,
        name: 'Test Account',
        type: 'ASSET',
        balance: '0',
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: null,
      } as any);

      const result = await purgeRecord(
        testCompanyId,
        'ACCOUNT',
        accountId,
        DeletionMethod.SECURE_DELETE,
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not soft-deleted');
    });

    it('should not purge financial record before 7-year period', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'ACCOUNT', 30, true);

      const accountId = nanoid();
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

      await db.accounts.add({
        id: accountId,
        companyId: testCompanyId,
        name: 'Test Account',
        type: 'ASSET',
        balance: '0',
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      const result = await purgeRecord(
        testCompanyId,
        'ACCOUNT',
        accountId,
        DeletionMethod.SECURE_DELETE,
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not eligible for purge');
    });

    it('should purge non-financial record after retention period', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);

      const contactId = nanoid();
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

      await db.contacts.add({
        id: contactId,
        companyId: testCompanyId,
        name: 'Test Contact',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      const result = await purgeRecord(
        testCompanyId,
        'CONTACT',
        contactId,
        DeletionMethod.SECURE_DELETE,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();

      // Verify record is deleted
      const deleted = await db.contacts.get(contactId);
      expect(deleted).toBeUndefined();

      // Verify deletion log created
      const logs = await getDeletionLogs(testCompanyId, { entityId: contactId });
      expect(logs).toHaveLength(1);
      expect(logs[0].entity_type).toBe('CONTACT');
      expect(logs[0].deletion_method).toBe(DeletionMethod.SECURE_DELETE);
    });

    it('should allow purging financial record when enforceMinimum is false', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'ACCOUNT', 30, false);

      const accountId = nanoid();
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

      await db.accounts.add({
        id: accountId,
        companyId: testCompanyId,
        name: 'Test Account',
        type: 'ASSET',
        balance: '1000',
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      const result = await purgeRecord(
        testCompanyId,
        'ACCOUNT',
        accountId,
        DeletionMethod.SECURE_DELETE,
        testUserId
      );

      expect(result.success).toBe(true);

      // Verify deletion log
      const logs = await getDeletionLogs(testCompanyId);
      expect(logs).toHaveLength(1);
      expect(logs[0].entity_type).toBe('ACCOUNT');
    });
  });

  describe('autoPurgeCompany', () => {
    it('should purge eligible records and skip protected ones', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);
      await upsertRetentionPolicy(testCompanyId, testUserId, 'ACCOUNT', 30, true);

      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // Eligible contact (non-financial, old enough)
      await db.contacts.add({
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Eligible Contact',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      // Protected account (financial, not old enough)
      await db.accounts.add({
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Protected Account',
        type: 'ASSET',
        balance: '1000',
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      // Recent contact (not old enough)
      await db.contacts.add({
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Recent Contact',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: oneDayAgo,
      } as any);

      const result = await autoPurgeCompany(testCompanyId, {
        enabled: true,
        schedule_cron: '0 2 * * *',
        batch_size: 100,
        dry_run: false,
        notify_admin: false,
      });

      expect(result.total_processed).toBe(3);
      expect(result.total_purged).toBe(1); // Only eligible contact
      expect(result.total_protected).toBeGreaterThan(0); // Protected account
      expect(result.total_failed).toBe(0);
    });

    it('should perform dry run without deleting', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);

      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

      await db.contacts.add({
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Test Contact',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      const result = await autoPurgeCompany(testCompanyId, {
        enabled: true,
        schedule_cron: '0 2 * * *',
        batch_size: 100,
        dry_run: true,
        notify_admin: false,
      });

      expect(result.total_purged).toBe(1);

      // Verify record still exists
      const contacts = await db.contacts
        .where('companyId')
        .equals(testCompanyId)
        .toArray();
      expect(contacts).toHaveLength(1);
    });
  });

  describe('getRetentionStatistics', () => {
    it('should calculate statistics correctly', async () => {
      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);

      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // Eligible contact
      await db.contacts.add({
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Eligible',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      // Recent contact
      await db.contacts.add({
        id: nanoid(),
        companyId: testCompanyId,
        name: 'Recent',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: oneDayAgo,
      } as any);

      const stats = await getRetentionStatistics(testCompanyId);

      expect(stats.company_id).toBe(testCompanyId);
      expect(stats.total_soft_deleted).toBeGreaterThan(0);
      expect(stats.eligible_for_purge).toBeGreaterThan(0);
      expect(stats.by_entity_type).toBeTruthy();
    });
  });

  describe('getDeletionLogs', () => {
    it('should return deletion logs for company', async () => {
      const contactId = nanoid();
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

      await db.contacts.add({
        id: contactId,
        companyId: testCompanyId,
        name: 'Test Contact',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: ninetyDaysAgo,
      } as any);

      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);

      await purgeRecord(
        testCompanyId,
        'CONTACT',
        contactId,
        DeletionMethod.SECURE_DELETE,
        testUserId
      );

      const logs = await getDeletionLogs(testCompanyId);
      expect(logs).toHaveLength(1);
      expect(logs[0].company_id).toBe(testCompanyId);
      expect(logs[0].entity_type).toBe('CONTACT');
      expect(logs[0].entity_id).toBe(contactId);
    });

    it('should filter logs by entity type', async () => {
      // Create and purge contact
      const contactId = nanoid();
      await db.contacts.add({
        id: contactId,
        companyId: testCompanyId,
        name: 'Test',
        type: 'CUSTOMER',
        isActive: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deletedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
      } as any);

      await upsertRetentionPolicy(testCompanyId, testUserId, 'CONTACT', 30, true);
      await purgeRecord(testCompanyId, 'CONTACT', contactId, 'AUTO_PURGE' as DeletionMethod);

      const contactLogs = await getDeletionLogs(testCompanyId, {
        entityType: 'CONTACT',
      });
      expect(contactLogs).toHaveLength(1);
      expect(contactLogs[0].entity_type).toBe('CONTACT');

      const accountLogs = await getDeletionLogs(testCompanyId, {
        entityType: 'ACCOUNT',
      });
      expect(accountLogs).toHaveLength(0);
    });
  });
});
