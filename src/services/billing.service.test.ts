/**
 * Billing Service Tests
 *
 * Tests for billing calculation logic, tier management, and proration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db/database';
import type { AdvisorClient, AdvisorTeamMember } from '../types/billing.types';
import { PRICING } from '../types/billing.types';
import {
  calculateAdvisorMonthlyCost,
  getBillingTier,
  getTierPrice,
  calculateProration,
  getTierChange,
  addClientToAdvisorPlan,
  acceptClientInvitation,
  removeClientFromAdvisorPlan,
  formatCurrency,
} from './billing.service';

describe('Billing Service', () => {
  const testAdvisorId = 'test-advisor-1';
  const testUserId = 'test-user-1';

  beforeEach(async () => {
    // Clear test data
    await db.advisorClients.clear();
    await db.advisorTeamMembers.clear();
  });

  afterEach(async () => {
    // Cleanup
    await db.advisorClients.clear();
    await db.advisorTeamMembers.clear();
  });

  describe('calculateAdvisorMonthlyCost', () => {
    it('should calculate $0 for 0-3 clients', async () => {
      // Add 3 active clients
      await createActiveClients(testAdvisorId, 3);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      expect(result.clientCount).toBe(3);
      expect(result.clientCharge).toBe(0);
      expect(result.totalMonthlyCost).toBe(0);
      expect(result.tier).toBe('free');
    });

    it('should calculate $50 for 4-50 clients', async () => {
      // Add 25 active clients
      await createActiveClients(testAdvisorId, 25);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      expect(result.clientCount).toBe(25);
      expect(result.clientCharge).toBe(PRICING.ADVISOR_TIER_1);
      expect(result.totalMonthlyCost).toBe(PRICING.ADVISOR_TIER_1);
      expect(result.tier).toBe('tier_1');
    });

    it('should calculate $100 for 51-100 clients', async () => {
      // Add 75 active clients
      await createActiveClients(testAdvisorId, 75);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      expect(result.clientCount).toBe(75);
      expect(result.clientCharge).toBe(PRICING.ADVISOR_TIER_2);
      expect(result.totalMonthlyCost).toBe(PRICING.ADVISOR_TIER_2);
      expect(result.tier).toBe('tier_2');
    });

    it('should calculate $150 for 101-150 clients', async () => {
      // Add 125 active clients
      await createActiveClients(testAdvisorId, 125);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      expect(result.clientCount).toBe(125);
      expect(result.clientCharge).toBe(PRICING.ADVISOR_TIER_3);
      expect(result.totalMonthlyCost).toBe(PRICING.ADVISOR_TIER_3);
      expect(result.tier).toBe('tier_3');
    });

    it('should calculate custom tier for 150+ clients', async () => {
      // Add 200 active clients
      await createActiveClients(testAdvisorId, 200);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      expect(result.clientCount).toBe(200);
      // 200 / 50 = 4 blocks, 4 * $50 = $200
      expect(result.clientCharge).toBe(20000);
      expect(result.totalMonthlyCost).toBe(20000);
      expect(result.tier).toBe('custom');
    });

    it('should not count pending or removed clients', async () => {
      // Add 5 active clients
      await createActiveClients(testAdvisorId, 5);

      // Add 2 pending clients
      await createPendingClients(testAdvisorId, 2);

      // Add 1 removed client
      await createRemovedClients(testAdvisorId, 1);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      // Should only count the 5 active clients
      expect(result.clientCount).toBe(5);
      expect(result.clientCharge).toBe(PRICING.ADVISOR_TIER_1);
    });

    it('should calculate team member charges correctly', async () => {
      // Add 4 clients (free tier)
      await createActiveClients(testAdvisorId, 4);

      // Add 8 active team members
      await createActiveTeamMembers(testAdvisorId, 8);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      expect(result.teamMemberCount).toBe(8);
      // 8 - 5 free = 3 billable team members × $2.50 = $7.50
      expect(result.teamMemberCharge).toBe(750);
      // Client charge ($50) + Team member charge ($7.50) = $57.50
      expect(result.totalMonthlyCost).toBe(5750);
    });

    it('should calculate per-client cost correctly', async () => {
      // Add 50 clients
      await createActiveClients(testAdvisorId, 50);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      // $50 / 50 clients = $1 per client
      expect(result.perClientCost).toBe(100);
    });

    it('should include charity contribution (informational)', async () => {
      // Add 10 clients
      await createActiveClients(testAdvisorId, 10);

      const result = await calculateAdvisorMonthlyCost(testAdvisorId);

      expect(result.charityContribution).toBe(PRICING.CHARITY_CONTRIBUTION);
      // Charity is NOT added to total (already included in tier price)
      expect(result.totalMonthlyCost).toBe(PRICING.ADVISOR_TIER_1);
    });
  });

  describe('getBillingTier', () => {
    it('should return correct tier for client counts', () => {
      expect(getBillingTier(0)).toBe('free');
      expect(getBillingTier(3)).toBe('free');
      expect(getBillingTier(4)).toBe('tier_1');
      expect(getBillingTier(50)).toBe('tier_1');
      expect(getBillingTier(51)).toBe('tier_2');
      expect(getBillingTier(100)).toBe('tier_2');
      expect(getBillingTier(101)).toBe('tier_3');
      expect(getBillingTier(150)).toBe('tier_3');
      expect(getBillingTier(151)).toBe('custom');
      expect(getBillingTier(500)).toBe('custom');
    });
  });

  describe('getTierPrice', () => {
    it('should return correct price for client counts', () => {
      expect(getTierPrice(0)).toBe(0);
      expect(getTierPrice(3)).toBe(0);
      expect(getTierPrice(4)).toBe(PRICING.ADVISOR_TIER_1);
      expect(getTierPrice(50)).toBe(PRICING.ADVISOR_TIER_1);
      expect(getTierPrice(51)).toBe(PRICING.ADVISOR_TIER_2);
      expect(getTierPrice(100)).toBe(PRICING.ADVISOR_TIER_2);
      expect(getTierPrice(101)).toBe(PRICING.ADVISOR_TIER_3);
      expect(getTierPrice(150)).toBe(PRICING.ADVISOR_TIER_3);
      expect(getTierPrice(151)).toBe(20000); // 4 blocks × $50
      expect(getTierPrice(200)).toBe(20000); // 4 blocks × $50
      expect(getTierPrice(250)).toBe(25000); // 5 blocks × $50
    });
  });

  describe('calculateProration', () => {
    it('should prorate correctly for mid-month changes', () => {
      const periodStart = new Date('2026-01-01').getTime();
      const periodEnd = new Date('2026-02-01').getTime();
      const changeDate = new Date('2026-01-16').getTime(); // Mid-month

      const result = calculateProration(
        10000, // $100
        periodStart,
        periodEnd,
        changeDate
      );

      // Roughly half the month used, half remaining
      expect(result.oldAmount).toBeGreaterThan(4500);
      expect(result.oldAmount).toBeLessThan(5500);
      expect(result.newAmount).toBeGreaterThan(4500);
      expect(result.newAmount).toBeLessThan(5500);
    });

    it('should prorate correctly for early month change', () => {
      const periodStart = new Date('2026-01-01').getTime();
      const periodEnd = new Date('2026-02-01').getTime();
      const changeDate = new Date('2026-01-05').getTime(); // Early in month

      const result = calculateProration(
        10000, // $100
        periodStart,
        periodEnd,
        changeDate
      );

      // Most of month remaining
      expect(result.oldAmount).toBeLessThan(2000);
      expect(result.newAmount).toBeGreaterThan(8000);
    });
  });

  describe('getTierChange', () => {
    it('should detect upgrades correctly', () => {
      expect(getTierChange('free', 'tier_1')).toBe('upgrade');
      expect(getTierChange('tier_1', 'tier_2')).toBe('upgrade');
      expect(getTierChange('tier_2', 'tier_3')).toBe('upgrade');
      expect(getTierChange('tier_3', 'custom')).toBe('upgrade');
    });

    it('should detect downgrades correctly', () => {
      expect(getTierChange('tier_1', 'free')).toBe('downgrade');
      expect(getTierChange('tier_2', 'tier_1')).toBe('downgrade');
      expect(getTierChange('tier_3', 'tier_2')).toBe('downgrade');
      expect(getTierChange('custom', 'tier_3')).toBe('downgrade');
    });

    it('should detect same tier', () => {
      expect(getTierChange('free', 'free')).toBe('same');
      expect(getTierChange('tier_1', 'tier_1')).toBe('same');
      expect(getTierChange('tier_2', 'tier_2')).toBe('same');
    });
  });

  describe('addClientToAdvisorPlan', () => {
    it('should create client with pending_invitation status', async () => {
      const clientUuid = crypto.randomUUID();

      const client = await addClientToAdvisorPlan(
        testAdvisorId,
        clientUuid,
        testUserId
      );

      expect(client.advisor_id).toBe(testAdvisorId);
      expect(client.client_uuid).toBe(clientUuid);
      expect(client.relationship_status).toBe('pending_invitation');
      expect(client.invitation_token).toBeTruthy();
      expect(client.billing_started_at).toBeNull();
    });
  });

  describe('acceptClientInvitation', () => {
    it('should activate client and start billing', async () => {
      const clientUuid = crypto.randomUUID();

      const client = await addClientToAdvisorPlan(
        testAdvisorId,
        clientUuid,
        testUserId
      );

      await acceptClientInvitation(clientUuid, client.invitation_token!);

      const updated = await db.advisorClients.get(client.id);
      expect(updated?.relationship_status).toBe('active');
      expect(updated?.invitation_accepted_at).toBeTruthy();
      expect(updated?.billing_started_at).toBeTruthy();
    });

    it('should throw error for invalid invitation token', async () => {
      const clientUuid = crypto.randomUUID();

      await expect(
        acceptClientInvitation(clientUuid, 'invalid-token')
      ).rejects.toThrow('Invalid invitation token');
    });
  });

  describe('removeClientFromAdvisorPlan', () => {
    it('should mark client as removed and end billing', async () => {
      const clientUuid = crypto.randomUUID();

      const client = await addClientToAdvisorPlan(
        testAdvisorId,
        clientUuid,
        testUserId
      );

      await acceptClientInvitation(clientUuid, client.invitation_token!);

      await removeClientFromAdvisorPlan(
        testAdvisorId,
        clientUuid,
        testUserId
      );

      const updated = await db.advisorClients.get(client.id);
      expect(updated?.relationship_status).toBe('removed');
      expect(updated?.billing_ended_at).toBeTruthy();
    });
  });

  describe('formatCurrency', () => {
    it('should format cents to dollars correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(100)).toBe('$1.00');
      expect(formatCurrency(1000)).toBe('$10.00');
      expect(formatCurrency(5000)).toBe('$50.00');
      expect(formatCurrency(10000)).toBe('$100.00');
      expect(formatCurrency(5750)).toBe('$57.50');
    });
  });
});

// Helper functions

async function createActiveClients(
  advisorId: string,
  count: number
): Promise<void> {
  const clients: AdvisorClient[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    clients.push({
      id: crypto.randomUUID(),
      advisor_id: advisorId,
      client_uuid: crypto.randomUUID(),
      relationship_status: 'active',
      invitation_sent_at: now,
      invitation_accepted_at: now,
      invitation_token: null,
      billing_started_at: now,
      billing_ended_at: null,
      previous_advisor_id: null,
      transferred_at: null,
      created_at: now,
      updated_at: now,
      created_by: 'test',
      updated_by: 'test',
      deleted_at: null,
    });
  }

  await db.advisorClients.bulkAdd(clients);
}

async function createPendingClients(
  advisorId: string,
  count: number
): Promise<void> {
  const clients: AdvisorClient[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    clients.push({
      id: crypto.randomUUID(),
      advisor_id: advisorId,
      client_uuid: crypto.randomUUID(),
      relationship_status: 'pending_invitation',
      invitation_sent_at: now,
      invitation_accepted_at: null,
      invitation_token: crypto.randomUUID(),
      billing_started_at: null,
      billing_ended_at: null,
      previous_advisor_id: null,
      transferred_at: null,
      created_at: now,
      updated_at: now,
      created_by: 'test',
      updated_by: 'test',
      deleted_at: null,
    });
  }

  await db.advisorClients.bulkAdd(clients);
}

async function createRemovedClients(
  advisorId: string,
  count: number
): Promise<void> {
  const clients: AdvisorClient[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    clients.push({
      id: crypto.randomUUID(),
      advisor_id: advisorId,
      client_uuid: crypto.randomUUID(),
      relationship_status: 'removed',
      invitation_sent_at: now - 10000,
      invitation_accepted_at: now - 9000,
      invitation_token: null,
      billing_started_at: now - 9000,
      billing_ended_at: now,
      previous_advisor_id: null,
      transferred_at: null,
      created_at: now - 10000,
      updated_at: now,
      created_by: 'test',
      updated_by: 'test',
      deleted_at: null,
    });
  }

  await db.advisorClients.bulkAdd(clients);
}

async function createActiveTeamMembers(
  advisorId: string,
  count: number
): Promise<void> {
  const teamMembers: AdvisorTeamMember[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    teamMembers.push({
      id: crypto.randomUUID(),
      advisor_id: advisorId,
      team_member_user_id: crypto.randomUUID(),
      role: 'bookkeeper',
      custom_role_name: null,
      status: 'active',
      invitation_sent_at: now,
      invitation_accepted_at: now,
      invitation_token: null,
      created_at: now,
      updated_at: now,
      created_by: 'test',
      deleted_at: null,
    });
  }

  await db.advisorTeamMembers.bulkAdd(teamMembers);
}
