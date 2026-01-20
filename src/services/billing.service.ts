/**
 * Billing Service
 *
 * Handles billing calculations, tier management, and subscription logic for IC2
 * Implements advisor-based pricing with client tiers and team member billing
 */

import { db } from '../db/database';
import type {
  BillingCalculation,
  BillingTier,
  AdvisorClient,
  AdvisorTeamMember,
  RelationshipStatus,
  TeamMemberStatus,
} from '../types/billing.types';
import { PRICING, BILLING_TIERS } from '../types/billing.types';
import { logger } from '../utils/logger';

const billingLogger = logger.child('BillingService');

/**
 * Calculate advisor monthly cost based on client and team member counts
 *
 * Implements the pricing logic from J7_ADVISOR_CLIENT_DATA_MODEL.md
 */
export async function calculateAdvisorMonthlyCost(
  advisorId: string
): Promise<BillingCalculation> {
  try {
    // Step 1: Count active clients
    const activeClients = await db.advisorClients
      .where('[advisor_id+relationship_status]')
      .equals([advisorId, 'active'])
      .count();

    const clientCount = activeClients;

    // Step 2: Calculate client charge based on tier
    let clientCharge = 0;
    let tier: BillingTier = 'free';
    let tierDescription = '';

    if (clientCount <= PRICING.CLIENTS_FREE) {
      // First 3 clients free
      clientCharge = 0;
      tier = 'free';
      tierDescription = 'First 3 clients free';
    } else if (clientCount <= 50) {
      // 4-50 clients: $50/month
      clientCharge = PRICING.ADVISOR_TIER_1;
      tier = 'tier_1';
      tierDescription = '4-50 clients';
    } else if (clientCount <= 100) {
      // 51-100 clients: $100/month
      clientCharge = PRICING.ADVISOR_TIER_2;
      tier = 'tier_2';
      tierDescription = '51-100 clients';
    } else if (clientCount <= 150) {
      // 101-150 clients: $150/month
      clientCharge = PRICING.ADVISOR_TIER_3;
      tier = 'tier_3';
      tierDescription = '101-150 clients';
    } else {
      // 150+ clients: $50 per 50 clients (custom tier)
      const blocks = Math.ceil(clientCount / PRICING.ADVISOR_BLOCK_SIZE);
      clientCharge = blocks * PRICING.ADVISOR_TIER_1;
      tier = 'custom';
      tierDescription = `${clientCount} clients (${blocks} blocks)`;
    }

    // Step 3: Count active team members
    const activeTeamMembers = await db.advisorTeamMembers
      .where('[advisor_id+status]')
      .equals([advisorId, 'active'])
      .count();

    const teamMemberCount = activeTeamMembers;

    // Step 4: Calculate team member charge
    let teamMemberCharge = 0;
    if (teamMemberCount > PRICING.TEAM_MEMBERS_FREE) {
      teamMemberCharge =
        (teamMemberCount - PRICING.TEAM_MEMBERS_FREE) *
        PRICING.TEAM_MEMBER_PRICE;
    }

    // Step 5: Charity contribution (informational, included in prices)
    const charityContribution =
      clientCharge > 0 || teamMemberCharge > 0
        ? PRICING.CHARITY_CONTRIBUTION
        : 0;

    // Step 6: Calculate total
    const totalMonthlyCost = clientCharge + teamMemberCharge;

    // Step 7: Calculate per-client cost
    const perClientCost =
      clientCount > 0 ? totalMonthlyCost / clientCount : 0;

    billingLogger.debug('Calculated advisor billing', {
      advisorId,
      clientCount,
      teamMemberCount,
      tier,
      totalMonthlyCost,
    });

    return {
      clientCount,
      clientCharge,
      teamMemberCount,
      teamMemberCharge,
      charityContribution,
      totalMonthlyCost,
      perClientCost,
      tier,
      tierDescription,
    };
  } catch (error) {
    billingLogger.error('Error calculating advisor billing', error);
    throw error;
  }
}

/**
 * Get the appropriate billing tier for a given client count
 */
export function getBillingTier(clientCount: number): BillingTier {
  if (clientCount <= PRICING.CLIENTS_FREE) {
    return 'free';
  } else if (clientCount <= 50) {
    return 'tier_1';
  } else if (clientCount <= 100) {
    return 'tier_2';
  } else if (clientCount <= 150) {
    return 'tier_3';
  } else {
    return 'custom';
  }
}

/**
 * Get tier price for a specific client count
 */
export function getTierPrice(clientCount: number): number {
  if (clientCount <= PRICING.CLIENTS_FREE) {
    return 0;
  } else if (clientCount <= 50) {
    return PRICING.ADVISOR_TIER_1;
  } else if (clientCount <= 100) {
    return PRICING.ADVISOR_TIER_2;
  } else if (clientCount <= 150) {
    return PRICING.ADVISOR_TIER_3;
  } else {
    // Custom tier: $50 per 50 clients
    const blocks = Math.ceil(clientCount / PRICING.ADVISOR_BLOCK_SIZE);
    return blocks * PRICING.ADVISOR_TIER_1;
  }
}

/**
 * Calculate prorated amount for mid-month changes
 *
 * @param amount - Full monthly amount in cents
 * @param periodStart - Period start timestamp (milliseconds)
 * @param periodEnd - Period end timestamp (milliseconds)
 * @param changeDate - Date of change (milliseconds)
 * @returns Prorated amount in cents
 */
export function calculateProration(
  amount: number,
  periodStart: number,
  periodEnd: number,
  changeDate: number
): { oldAmount: number; newAmount: number } {
  const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
  const daysUsed = Math.ceil((changeDate - periodStart) / (1000 * 60 * 60 * 24));
  const daysRemaining = totalDays - daysUsed;

  const oldAmount = Math.floor((amount * daysUsed) / totalDays);
  const newAmount = Math.floor((amount * daysRemaining) / totalDays);

  return { oldAmount, newAmount };
}

/**
 * Determine if tier change is upgrade or downgrade
 */
export function getTierChange(
  oldTier: BillingTier,
  newTier: BillingTier
): 'upgrade' | 'downgrade' | 'same' {
  const tierOrder: BillingTier[] = [
    'free',
    'tier_1',
    'tier_2',
    'tier_3',
    'custom',
  ];
  const oldIndex = tierOrder.indexOf(oldTier);
  const newIndex = tierOrder.indexOf(newTier);

  if (newIndex > oldIndex) {
    return 'upgrade';
  } else if (newIndex < oldIndex) {
    return 'downgrade';
  } else {
    return 'same';
  }
}

/**
 * Get all active clients for an advisor
 */
export async function getAdvisorActiveClients(
  advisorId: string
): Promise<AdvisorClient[]> {
  return db.advisorClients
    .where('[advisor_id+relationship_status]')
    .equals([advisorId, 'active'])
    .toArray();
}

/**
 * Get all active team members for an advisor
 */
export async function getAdvisorActiveTeamMembers(
  advisorId: string
): Promise<AdvisorTeamMember[]> {
  return db.advisorTeamMembers
    .where('[advisor_id+status]')
    .equals([advisorId, 'active'])
    .toArray();
}

/**
 * Add a client to advisor's plan
 */
export async function addClientToAdvisorPlan(
  advisorId: string,
  clientUuid: string,
  createdBy: string
): Promise<AdvisorClient> {
  const now = Date.now();

  const client: AdvisorClient = {
    id: crypto.randomUUID(),
    advisor_id: advisorId,
    client_uuid: clientUuid,
    relationship_status: 'pending_invitation',
    invitation_sent_at: now,
    invitation_accepted_at: null,
    invitation_token: generateInvitationToken(),
    billing_started_at: null,
    billing_ended_at: null,
    previous_advisor_id: null,
    transferred_at: null,
    created_at: now,
    updated_at: now,
    created_by: createdBy,
    updated_by: createdBy,
    deleted_at: null,
  };

  await db.advisorClients.add(client);
  billingLogger.info('Added client to advisor plan', {
    advisorId,
    clientUuid,
  });

  return client;
}

/**
 * Accept client invitation
 */
export async function acceptClientInvitation(
  clientUuid: string,
  invitationToken: string
): Promise<void> {
  const client = await db.advisorClients
    .where('client_uuid')
    .equals(clientUuid)
    .and((c) => c.invitation_token === invitationToken)
    .first();

  if (!client) {
    throw new Error('Invalid invitation token');
  }

  const now = Date.now();

  await db.advisorClients.update(client.id, {
    relationship_status: 'active',
    invitation_accepted_at: now,
    billing_started_at: now,
    updated_at: now,
  });

  billingLogger.info('Client accepted invitation', {
    advisorId: client.advisor_id,
    clientUuid,
  });
}

/**
 * Remove client from advisor's plan
 */
export async function removeClientFromAdvisorPlan(
  advisorId: string,
  clientUuid: string,
  updatedBy: string
): Promise<void> {
  const client = await db.advisorClients
    .where('[advisor_id+client_uuid]')
    .equals([advisorId, clientUuid])
    .first();

  if (!client) {
    throw new Error('Client not found in advisor plan');
  }

  const now = Date.now();

  await db.advisorClients.update(client.id, {
    relationship_status: 'removed',
    billing_ended_at: now,
    updated_at: now,
    updated_by: updatedBy,
  });

  billingLogger.info('Removed client from advisor plan', {
    advisorId,
    clientUuid,
  });
}

/**
 * Add team member to advisor's team
 */
export async function addTeamMemberToAdvisor(
  advisorId: string,
  teamMemberUserId: string,
  role: string,
  createdBy: string
): Promise<AdvisorTeamMember> {
  const now = Date.now();

  const teamMember: AdvisorTeamMember = {
    id: crypto.randomUUID(),
    advisor_id: advisorId,
    team_member_user_id: teamMemberUserId,
    role: role as any,
    custom_role_name: null,
    status: 'pending_invitation',
    invitation_sent_at: now,
    invitation_accepted_at: null,
    invitation_token: generateInvitationToken(),
    created_at: now,
    updated_at: now,
    created_by: createdBy,
    deleted_at: null,
  };

  await db.advisorTeamMembers.add(teamMember);
  billingLogger.info('Added team member to advisor', {
    advisorId,
    teamMemberUserId,
  });

  return teamMember;
}

/**
 * Remove team member from advisor's team
 */
export async function removeTeamMemberFromAdvisor(
  advisorId: string,
  teamMemberUserId: string
): Promise<void> {
  const teamMember = await db.advisorTeamMembers
    .where('[advisor_id+team_member_user_id]')
    .equals([advisorId, teamMemberUserId])
    .first();

  if (!teamMember) {
    throw new Error('Team member not found');
  }

  const now = Date.now();

  await db.advisorTeamMembers.update(teamMember.id, {
    status: 'deactivated',
    updated_at: now,
  });

  billingLogger.info('Removed team member from advisor', {
    advisorId,
    teamMemberUserId,
  });
}

/**
 * Generate a secure invitation token
 */
function generateInvitationToken(): string {
  return crypto.randomUUID();
}

/**
 * Format currency amount in cents to dollars
 */
export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

/**
 * Format billing summary for display
 */
export function formatBillingSummary(
  calculation: BillingCalculation
): string {
  const parts: string[] = [];

  if (calculation.clientCount > 0) {
    parts.push(
      `${calculation.clientCount} client${calculation.clientCount > 1 ? 's' : ''}`
    );
  }

  if (calculation.teamMemberCount > 0) {
    parts.push(
      `${calculation.teamMemberCount} team member${calculation.teamMemberCount > 1 ? 's' : ''}`
    );
  }

  if (calculation.clientCharge > 0) {
    parts.push(`${formatCurrency(calculation.clientCharge)} for clients`);
  }

  if (calculation.teamMemberCharge > 0) {
    parts.push(
      `${formatCurrency(calculation.teamMemberCharge)} for team members`
    );
  }

  return parts.join(' + ');
}
