/**
 * Charity Distribution Service
 *
 * Handles charity payment distribution operations for admin users.
 * Tracks monthly contributions, generates distribution reports, and manages payment workflows.
 *
 * Requirements:
 * - IC2.5: Charity Payment Distribution System
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import type { CharityDistribution } from '../../types/billing.types';
import { PRICING } from '../../types/billing.types';

/**
 * Monthly contribution summary for a charity
 */
export interface MonthlyContributionSummary {
  charity_id: string;
  charity_name: string;
  charity_ein: string;
  total_amount: number; // in cents
  contributor_count: number;
  payment_address: string | null;
  website: string;
}

/**
 * Payment distribution record for marking as sent
 */
export interface MarkPaymentSentInput {
  distributionId: string;
  paymentMethod: 'ach' | 'check' | 'wire';
  confirmationNumber?: string;
  sentBy: string; // Admin user ID
}

/**
 * Payment confirmation input
 */
export interface ConfirmPaymentInput {
  distributionId: string;
  confirmedBy: string; // Admin user ID
}

/**
 * Monthly distribution report data
 */
export interface MonthlyDistributionReport {
  month: string; // YYYY-MM
  generated_at: number;
  total_amount: number; // in cents
  charity_count: number;
  contributions: MonthlyContributionSummary[];
}

/**
 * User annual contribution summary
 */
export interface UserAnnualContribution {
  user_id: string;
  year: number;
  charity_id: string;
  charity_name: string;
  charity_ein: string;
  total_amount: number; // in cents
  months_contributed: number;
}

/**
 * Charity impact statistics
 */
export interface CharityImpactStats {
  charity_id: string;
  charity_name: string;
  lifetime_contributions: number; // in cents
  total_contributors: number;
  first_contribution_date: number | null;
  latest_contribution_date: number | null;
  monthly_growth: MonthlyGrowthData[];
}

/**
 * Monthly growth data point
 */
export interface MonthlyGrowthData {
  month: string; // YYYY-MM
  amount: number; // in cents
  contributor_count: number;
}

/**
 * Calculate total contributions per charity for a given month
 *
 * @param month - Month in YYYY-MM format
 * @returns Array of contribution summaries per charity
 */
export async function calculateMonthlyContributions(
  month: string
): Promise<MonthlyContributionSummary[]> {
  try {
    // Get all active subscriptions for the month
    const subscriptions = await db.subscriptions
      .filter(sub => {
        if (sub.deleted_at !== null) return false;
        if (sub.status !== 'active' && sub.status !== 'trialing') return false;

        // Check if subscription was active during the month
        const [year, monthNum] = month.split('-').map(Number);
        const monthStart = new Date(year || 0, (monthNum || 1) - 1, 1).getTime();
        const monthEnd = new Date(year || 0, monthNum || 1, 0, 23, 59, 59, 999).getTime();

        // Subscription must have started before month end
        if (sub.created_at > monthEnd) return false;

        // If canceled, must have been active during the month
        if (sub.canceled_at && sub.canceled_at < monthStart) return false;

        return true;
      })
      .toArray();

    // Get all charities
    const charities = await db.charities.toArray();
    const charityMap = new Map(charities.map(c => [c.id, c]));

    // Group subscriptions by user to get their selected charity
    // Note: In production, we'd join with a user_charities table
    // For now, we'll assume charity selection is stored on the user record
    const users = await db.users.toArray();
    const userCharityMap = new Map(
      users
        .filter(u => u.selected_charity_id)
        .map(u => [u.id, u.selected_charity_id!])
    );

    // Calculate contributions per charity
    const contributionMap = new Map<string, MonthlyContributionSummary>();

    for (const sub of subscriptions) {
      const charityId = userCharityMap.get(sub.user_id);
      if (!charityId) continue; // User hasn't selected a charity

      const charity = charityMap.get(charityId);
      if (!charity || charity.status !== 'VERIFIED') continue; // Only verified charities

      const existing = contributionMap.get(charityId);
      if (existing) {
        existing.total_amount += PRICING.CHARITY_CONTRIBUTION;
        existing.contributor_count += 1;
      } else {
        contributionMap.set(charityId, {
          charity_id: charityId,
          charity_name: charity.name,
          charity_ein: charity.ein,
          total_amount: PRICING.CHARITY_CONTRIBUTION,
          contributor_count: 1,
          payment_address: charity.payment_address || null,
          website: charity.website,
        });
      }
    }

    return Array.from(contributionMap.values()).sort(
      (a, b) => b.total_amount - a.total_amount
    );
  } catch (error) {
    console.error('Error calculating monthly contributions:', error);
    throw new Error('Failed to calculate monthly contributions');
  }
}

/**
 * Generate monthly distribution report
 *
 * @param month - Month in YYYY-MM format
 * @returns Monthly distribution report
 */
export async function generateMonthlyReport(
  month: string
): Promise<MonthlyDistributionReport> {
  try {
    const contributions = await calculateMonthlyContributions(month);

    const total_amount = contributions.reduce(
      (sum, c) => sum + c.total_amount,
      0
    );

    return {
      month,
      generated_at: Date.now(),
      total_amount,
      charity_count: contributions.length,
      contributions,
    };
  } catch (error) {
    console.error('Error generating monthly report:', error);
    throw new Error('Failed to generate monthly distribution report');
  }
}

/**
 * Export monthly report to CSV format
 *
 * @param report - Monthly distribution report
 * @returns CSV string
 */
export function exportReportToCSV(report: MonthlyDistributionReport): string {
  const headers = [
    'Charity Name',
    'EIN',
    'Total Amount (USD)',
    'Contributor Count',
    'Payment Address',
    'Website',
  ];

  const rows = report.contributions.map(c => [
    c.charity_name,
    c.charity_ein,
    (c.total_amount / 100).toFixed(2),
    c.contributor_count.toString(),
    c.payment_address || 'N/A',
    c.website,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Create or update charity distribution record
 *
 * @param month - Month in YYYY-MM format
 * @returns Array of created distribution records
 */
export async function createDistributionRecords(
  month: string
): Promise<CharityDistribution[]> {
  try {
    const contributions = await calculateMonthlyContributions(month);
    const now = Date.now();
    const records: CharityDistribution[] = [];

    // Check if distributions already exist for this month
    const existing = await db.charityDistributions
      .where('month')
      .equals(month)
      .toArray();

    const existingMap = new Map(existing.map(d => [d.charity_id, d]));

    for (const contribution of contributions) {
      const existingRecord = existingMap.get(contribution.charity_id);

      if (existingRecord) {
        // Update existing record
        const updated: CharityDistribution = {
          ...existingRecord,
          charity_name: contribution.charity_name,
          charity_ein: contribution.charity_ein,
          total_amount: contribution.total_amount,
          contributor_count: contribution.contributor_count,
          updated_at: now,
        };
        await db.charityDistributions.update(existingRecord.id, updated);
        records.push(updated);
      } else {
        // Create new record
        const record: CharityDistribution = {
          id: uuidv4(),
          month,
          charity_id: contribution.charity_id,
          charity_name: contribution.charity_name,
          charity_ein: contribution.charity_ein,
          total_amount: contribution.total_amount,
          contributor_count: contribution.contributor_count,
          status: 'pending',
          payment_method: null,
          sent_at: null,
          confirmed_at: null,
          created_at: now,
          updated_at: now,
        };
        await db.charityDistributions.add(record);
        records.push(record);
      }
    }

    return records;
  } catch (error) {
    console.error('Error creating distribution records:', error);
    throw new Error('Failed to create distribution records');
  }
}

/**
 * Mark payment as sent
 *
 * @param input - Payment sent input
 * @returns Updated distribution record
 */
export async function markPaymentSent(
  input: MarkPaymentSentInput
): Promise<CharityDistribution> {
  try {
    const distribution = await db.charityDistributions.get(input.distributionId);
    if (!distribution) {
      throw new Error('Distribution record not found');
    }

    if (distribution.status !== 'pending') {
      throw new Error(`Cannot mark payment as sent. Current status: ${distribution.status}`);
    }

    const updated: CharityDistribution = {
      ...distribution,
      status: 'sent',
      payment_method: input.paymentMethod,
      sent_at: Date.now(),
      updated_at: Date.now(),
    };

    await db.charityDistributions.update(input.distributionId, updated);

    // Log to audit (would integrate with audit service in production)
    console.log(
      `Payment sent: ${distribution.charity_name} - $${distribution.total_amount / 100} via ${input.paymentMethod} by admin ${input.sentBy}`
    );

    return updated;
  } catch (error) {
    console.error('Error marking payment as sent:', error);
    throw error instanceof Error ? error : new Error('Failed to mark payment as sent');
  }
}

/**
 * Confirm payment receipt from charity
 *
 * @param input - Payment confirmation input
 * @returns Updated distribution record
 */
export async function confirmPayment(
  input: ConfirmPaymentInput
): Promise<CharityDistribution> {
  try {
    const distribution = await db.charityDistributions.get(input.distributionId);
    if (!distribution) {
      throw new Error('Distribution record not found');
    }

    if (distribution.status !== 'sent') {
      throw new Error(`Cannot confirm payment. Current status: ${distribution.status}`);
    }

    const updated: CharityDistribution = {
      ...distribution,
      status: 'confirmed',
      confirmed_at: Date.now(),
      updated_at: Date.now(),
    };

    await db.charityDistributions.update(input.distributionId, updated);

    // Log to audit (would integrate with audit service in production)
    console.log(
      `Payment confirmed: ${distribution.charity_name} - $${distribution.total_amount / 100} confirmed by admin ${input.confirmedBy}`
    );

    return updated;
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error instanceof Error ? error : new Error('Failed to confirm payment');
  }
}

/**
 * Get distributions for a specific month
 *
 * @param month - Month in YYYY-MM format
 * @returns Array of distribution records
 */
export async function getDistributionsForMonth(
  month: string
): Promise<CharityDistribution[]> {
  try {
    return await db.charityDistributions
      .where('month')
      .equals(month)
      .toArray();
  } catch (error) {
    console.error('Error fetching distributions:', error);
    throw new Error('Failed to fetch distributions for month');
  }
}

/**
 * Get unpaid distributions (pending > 15 days)
 *
 * @returns Array of overdue distribution records
 */
export async function getUnpaidDistributions(): Promise<CharityDistribution[]> {
  try {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;

    return await db.charityDistributions
      .filter(d => d.status === 'pending' && d.created_at < fifteenDaysAgo)
      .toArray();
  } catch (error) {
    console.error('Error fetching unpaid distributions:', error);
    throw new Error('Failed to fetch unpaid distributions');
  }
}

/**
 * Calculate user's annual contribution summary
 *
 * @param userId - User ID
 * @param year - Year (e.g., 2026)
 * @returns Annual contribution summary
 */
export async function getUserAnnualContribution(
  userId: string,
  year: number
): Promise<UserAnnualContribution | null> {
  try {
    // Get user's selected charity
    const user = await db.users.get(userId);
    if (!user || !user.selected_charity_id) {
      return null;
    }

    // Get charity details
    const charity = await db.charities.get(user.selected_charity_id);
    if (!charity) {
      return null;
    }

    // Get all subscriptions for this user in the year
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    const subscriptions = await db.subscriptions
      .where('user_id')
      .equals(userId)
      .filter(sub => {
        if (sub.deleted_at !== null) return false;

        // Subscription must have been active at some point during the year
        if (sub.created_at > yearEnd) return false;
        if (sub.canceled_at && sub.canceled_at < yearStart) return false;

        return true;
      })
      .toArray();

    if (subscriptions.length === 0) {
      return null;
    }

    // Calculate months contributed
    let monthsContributed = 0;
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1).getTime();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

      const activeInMonth = subscriptions.some(sub => {
        if (sub.created_at > monthEnd) return false;
        if (sub.canceled_at && sub.canceled_at < monthStart) return false;
        if (sub.status !== 'active' && sub.status !== 'trialing') return false;
        return true;
      });

      if (activeInMonth) {
        monthsContributed++;
      }
    }

    return {
      user_id: userId,
      year,
      charity_id: charity.id,
      charity_name: charity.name,
      charity_ein: charity.ein,
      total_amount: monthsContributed * PRICING.CHARITY_CONTRIBUTION,
      months_contributed: monthsContributed,
    };
  } catch (error) {
    console.error('Error calculating user annual contribution:', error);
    throw new Error('Failed to calculate annual contribution');
  }
}

/**
 * Get charity impact statistics
 *
 * @param charityId - Charity ID
 * @returns Charity impact statistics
 */
export async function getCharityImpactStats(
  charityId: string
): Promise<CharityImpactStats | null> {
  try {
    const charity = await db.charities.get(charityId);
    if (!charity) {
      return null;
    }

    // Get all distributions for this charity
    const distributions = await db.charityDistributions
      .where('charity_id')
      .equals(charityId)
      .toArray();

    if (distributions.length === 0) {
      return {
        charity_id: charityId,
        charity_name: charity.name,
        lifetime_contributions: 0,
        total_contributors: 0,
        first_contribution_date: null,
        latest_contribution_date: null,
        monthly_growth: [],
      };
    }

    const lifetime_contributions = distributions.reduce(
      (sum, d) => sum + d.total_amount,
      0
    );

    // Get unique contributors (approximate from contributor counts)
    const total_contributors = Math.max(
      ...distributions.map(d => d.contributor_count)
    );

    const sortedDates = distributions
      .map(d => d.created_at)
      .sort((a, b) => a - b);

    const monthly_growth: MonthlyGrowthData[] = distributions
      .map(d => ({
        month: d.month,
        amount: d.total_amount,
        contributor_count: d.contributor_count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      charity_id: charityId,
      charity_name: charity.name,
      lifetime_contributions,
      total_contributors,
      first_contribution_date: sortedDates[0] ?? null,
      latest_contribution_date: sortedDates[sortedDates.length - 1] ?? null,
      monthly_growth,
    };
  } catch (error) {
    console.error('Error fetching charity impact stats:', error);
    throw new Error('Failed to fetch charity impact statistics');
  }
}

/**
 * Get all charity impact statistics (for dashboard)
 *
 * @returns Array of charity impact statistics
 */
export async function getAllCharityImpactStats(): Promise<CharityImpactStats[]> {
  try {
    const distributions = await db.charityDistributions.toArray();
    const charityIds = Array.from(new Set(distributions.map(d => d.charity_id)));

    const stats = await Promise.all(
      charityIds.map(id => getCharityImpactStats(id))
    );

    return stats.filter((s): s is CharityImpactStats => s !== null);
  } catch (error) {
    console.error('Error fetching all charity impact stats:', error);
    throw new Error('Failed to fetch charity impact statistics');
  }
}

/**
 * Verify contribution reconciliation
 * Ensures total contributions match total distributed
 *
 * @param month - Month in YYYY-MM format
 * @returns Reconciliation result
 */
export async function reconcileContributions(month: string): Promise<{
  expected_total: number;
  distributed_total: number;
  difference: number;
  is_balanced: boolean;
}> {
  try {
    const report = await generateMonthlyReport(month);
    const distributions = await getDistributionsForMonth(month);

    const distributed_total = distributions.reduce(
      (sum, d) => sum + d.total_amount,
      0
    );

    const difference = report.total_amount - distributed_total;

    return {
      expected_total: report.total_amount,
      distributed_total,
      difference,
      is_balanced: difference === 0,
    };
  } catch (error) {
    console.error('Error reconciling contributions:', error);
    throw new Error('Failed to reconcile contributions');
  }
}
