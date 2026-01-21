/**
 * Scenario Sharing Service
 *
 * Handles push-to-client workflow for J3: Building the Dream Scenarios
 * Integrates with J7 (Advisor Portal) and IC4 (Email Service)
 *
 * Features:
 * - Push scenario to client with customizable email
 * - Track client viewing and response
 * - Handle client comments
 * - Support accept/decline workflow
 * - Manage permissions (view-only vs edit)
 */

import { db } from '../../db';
import { renderScenarioPushed } from '../email/templates/scenarioPushed';
import { EmailService } from '../email/email.service';
import type {
  Scenario,
  ScenarioShare,
  ScenarioComment,
  ScenarioShareStatus,
  ScenarioClientView,
  ScenarioProjection,
} from '../../types/scenarios.types';
import type { ScenarioPushedVariables } from '../../types/ic4-email.types';
import {
  SCENARIOS_TABLE,
  SCENARIO_SHARES_TABLE,
  SCENARIO_COMMENTS_TABLE,
} from '../../db/schema/scenarios.schema';

/**
 * Push scenario to client
 *
 * Creates a share record and sends email notification
 *
 * @param scenarioId - Scenario to share
 * @param clientUserId - Client to share with
 * @param advisorUserId - Advisor sharing the scenario
 * @param emailMessage - Custom message from advisor
 * @param allowClientEdit - Whether client can modify adjustments
 * @returns Share record
 */
export async function pushScenarioToClient(
  scenarioId: string,
  clientUserId: string,
  advisorUserId: string,
  emailMessage: string,
  allowClientEdit: boolean = false
): Promise<ScenarioShare> {
  // Fetch scenario
  const scenario = await (db as any)[SCENARIOS_TABLE].get(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  // Fetch advisor and client users
  const advisor = await db.users.get(advisorUserId);
  const client = await db.users.get(clientUserId);

  if (!advisor || !client) {
    throw new Error('Advisor or client not found');
  }

  // Check if already shared with this client
  const existingShare = await (db as any)[SCENARIO_SHARES_TABLE]
    .where(['scenario_id', 'shared_with_user_id'])
    .equals([scenarioId, clientUserId])
    .first();

  let share: ScenarioShare;

  if (existingShare) {
    // Update existing share
    share = {
      ...existingShare,
      email_message: emailMessage,
      allow_client_edit: allowClientEdit,
      shared_at: Date.now(),
      status: 'pending', // Reset to pending
      updated_at: Date.now(),
    };

    await (db as any)[SCENARIO_SHARES_TABLE].put(share);
  } else {
    // Create new share
    share = {
      id: crypto.randomUUID(),
      scenario_id: scenarioId,
      shared_with_user_id: clientUserId,
      shared_by_user_id: advisorUserId,
      status: 'pending',
      email_message: emailMessage,
      allow_client_edit: allowClientEdit,
      shared_at: Date.now(),
      viewed_at: null,
      responded_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };

    await (db as any)[SCENARIO_SHARES_TABLE].add(share);
  }

  // Update scenario status
  await (db as any)[SCENARIOS_TABLE].update(scenarioId, {
    status: 'shared',
    client_id: clientUserId,
    updated_at: Date.now(),
  });

  // Send email notification
  const scenarioUrl = `${window.location.origin}/scenarios/${scenarioId}/view`;

  const emailVariables: ScenarioPushedVariables = {
    clientFirstName: client.name.split(' ')[0] || client.name,
    advisorName: advisor.name,
    scenarioName: scenario.name,
    advisorNote: emailMessage,
    scenarioUrl,
  };

  const emailContent = renderScenarioPushed(emailVariables);

  await queueEmail({
    to: client.email,
    subject: emailContent.subject,
    html: emailContent.html,
    plainText: emailContent.plainText,
    template: 'scenario-pushed',
    variables: emailVariables,
  });

  return share;
}

/**
 * Mark scenario as viewed by client
 *
 * @param scenarioId - Scenario ID
 * @param clientUserId - Client user ID
 */
export async function markScenarioViewed(
  scenarioId: string,
  clientUserId: string
): Promise<void> {
  const share = await (db as any)[SCENARIO_SHARES_TABLE]
    .where(['scenario_id', 'shared_with_user_id'])
    .equals([scenarioId, clientUserId])
    .first();

  if (!share) {
    throw new Error('Scenario share not found');
  }

  if (!share.viewed_at) {
    await (db as any)[SCENARIO_SHARES_TABLE].update(share.id, {
      status: 'viewed',
      viewed_at: Date.now(),
      updated_at: Date.now(),
    });
  }
}

/**
 * Add client comment to scenario
 *
 * @param scenarioId - Scenario ID
 * @param userId - User adding comment (client or advisor)
 * @param commentText - Comment text
 * @param parentCommentId - Parent comment for threaded replies
 * @returns Created comment
 */
export async function addScenarioComment(
  scenarioId: string,
  userId: string,
  commentText: string,
  parentCommentId: string | null = null
): Promise<ScenarioComment> {
  const comment: ScenarioComment = {
    id: crypto.randomUUID(),
    scenario_id: scenarioId,
    created_by_id: userId,
    parent_comment_id: parentCommentId,
    comment_text: commentText,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
  };

  await (db as any)[SCENARIO_COMMENTS_TABLE].add(comment);

  // Update share status to 'commented' if client commented
  const share = await (db as any)[SCENARIO_SHARES_TABLE]
    .where(['scenario_id', 'shared_with_user_id'])
    .equals([scenarioId, userId])
    .first();

  if (share && share.status === 'viewed') {
    await (db as any)[SCENARIO_SHARES_TABLE].update(share.id, {
      status: 'commented',
      responded_at: Date.now(),
      updated_at: Date.now(),
    });
  }

  return comment;
}

/**
 * Client accepts scenario (wants to implement)
 *
 * @param scenarioId - Scenario ID
 * @param clientUserId - Client user ID
 */
export async function acceptScenario(
  scenarioId: string,
  clientUserId: string
): Promise<void> {
  const share = await (db as any)[SCENARIO_SHARES_TABLE]
    .where(['scenario_id', 'shared_with_user_id'])
    .equals([scenarioId, clientUserId])
    .first();

  if (!share) {
    throw new Error('Scenario share not found');
  }

  await (db as any)[SCENARIO_SHARES_TABLE].update(share.id, {
    status: 'accepted',
    responded_at: Date.now(),
    updated_at: Date.now(),
  });

  // Update scenario status
  await (db as any)[SCENARIOS_TABLE].update(scenarioId, {
    status: 'implemented',
    updated_at: Date.now(),
  });
}

/**
 * Client declines scenario
 *
 * @param scenarioId - Scenario ID
 * @param clientUserId - Client user ID
 * @param reason - Optional reason for declining
 */
export async function declineScenario(
  scenarioId: string,
  clientUserId: string,
  reason?: string
): Promise<void> {
  const share = await (db as any)[SCENARIO_SHARES_TABLE]
    .where(['scenario_id', 'shared_with_user_id'])
    .equals([scenarioId, clientUserId])
    .first();

  if (!share) {
    throw new Error('Scenario share not found');
  }

  await (db as any)[SCENARIO_SHARES_TABLE].update(share.id, {
    status: 'declined',
    responded_at: Date.now(),
    updated_at: Date.now(),
  });

  // Optionally add reason as a comment
  if (reason) {
    await addScenarioComment(scenarioId, clientUserId, `Declined: ${reason}`);
  }
}

/**
 * Get client view of scenario (simplified for non-accountants)
 *
 * @param scenarioId - Scenario ID
 * @param clientUserId - Client user ID
 * @returns Client-friendly view of scenario
 */
export async function getScenarioClientView(
  scenarioId: string,
  clientUserId: string
): Promise<ScenarioClientView> {
  // Fetch scenario
  const scenario = await (db as any)[SCENARIOS_TABLE].get(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  // Fetch share
  const share = await (db as any)[SCENARIO_SHARES_TABLE]
    .where(['scenario_id', 'shared_with_user_id'])
    .equals([scenarioId, clientUserId])
    .first();

  if (!share) {
    throw new Error('Scenario not shared with this client');
  }

  // Mark as viewed
  await markScenarioViewed(scenarioId, clientUserId);

  // Fetch advisor
  const advisor = await db.users.get(scenario.created_by_id);
  if (!advisor) {
    throw new Error('Advisor not found');
  }

  // Fetch baseline and calculate projection
  // (This would integrate with scenarioCalculator.service in production)
  // TODO: Generate actual baseline snapshot from scenarioCalculator
  const projection: ScenarioProjection = {} as any; // Placeholder

  // Fetch notes
  const notes = await db.scenario_notes
    .where('scenario_id')
    .equals(scenarioId)
    .and((note) => note.deleted_at === null)
    .toArray();

  // Fetch comments
  const comments = await (db as any)[SCENARIO_COMMENTS_TABLE]
    .where('scenario_id')
    .equals(scenarioId)
    .and((comment: any) => comment.deleted_at === null)
    .sortBy('created_at');

  // Build summary
  const summary = {
    current_profit: projection.baseline?.profit || 0,
    projected_profit: projection.projected?.profit || 0,
    profit_change: projection.delta?.profit || 0,
    profit_change_percentage:
      projection.baseline?.profit
        ? ((projection.delta?.profit || 0) / projection.baseline.profit) * 100
        : 0,
    current_revenue: projection.baseline?.revenue || 0,
    projected_revenue: projection.projected?.revenue || 0,
    current_expenses: projection.baseline?.expenses || 0,
    projected_expenses: projection.projected?.expenses || 0,
    one_time_costs: projection.adjustments?.one_time_costs || 0,
    runway_impact: formatRunwayImpact(
      projection.metrics?.runway_months_baseline,
      projection.metrics?.runway_months_projected
    ),
  };

  // Build key changes (simplified from adjustments)
  const key_changes: ScenarioClientView['key_changes'] = [];
  // Would populate from actual adjustments

  const clientView: ScenarioClientView = {
    scenario_name: scenario.name,
    description: scenario.description,
    advisor_name: advisor.name,
    advisor_note: share.email_message,
    summary,
    key_changes,
    notes,
    comments,
    can_comment: true,
    can_accept: share.status === 'viewed' || share.status === 'commented',
    can_decline: share.status === 'viewed' || share.status === 'commented',
    can_edit: share.allow_client_edit,
    shared_at: share.shared_at,
    viewed_at: share.viewed_at,
  };

  return clientView;
}

/**
 * Get all scenarios shared with a client
 *
 * @param clientUserId - Client user ID
 * @param status - Optional status filter
 * @returns Array of scenarios
 */
export async function getClientScenarios(
  clientUserId: string,
  status?: ScenarioShareStatus
): Promise<Array<Scenario & { share_status: ScenarioShareStatus }>> {
  let query = (db as any)[SCENARIO_SHARES_TABLE]
    .where('shared_with_user_id')
    .equals(clientUserId);

  if (status) {
    query = query.and((share: any) => share.status === status);
  }

  const shares = await query.toArray();

  const scenarios = await Promise.all(
    shares.map(async (share: any) => {
      const scenario = await (db as any)[SCENARIOS_TABLE].get(share.scenario_id);
      return scenario
        ? {
            ...scenario,
            share_status: share.status,
          }
        : null;
    })
  );

  return scenarios.filter((s: any) => s !== null) as Array<
    Scenario & { share_status: ScenarioShareStatus }
  >;
}

/**
 * Get client response summary for advisor
 *
 * @param scenarioId - Scenario ID
 * @returns Summary of client responses
 */
export async function getClientResponseSummary(scenarioId: string): Promise<{
  shares: ScenarioShare[];
  total_shares: number;
  pending: number;
  viewed: number;
  commented: number;
  accepted: number;
  declined: number;
  latest_comments: ScenarioComment[];
}> {
  const shares = await (db as any)[SCENARIO_SHARES_TABLE]
    .where('scenario_id')
    .equals(scenarioId)
    .and((share: any) => share.deleted_at === null)
    .toArray();

  const comments = await (db as any)[SCENARIO_COMMENTS_TABLE]
    .where('scenario_id')
    .equals(scenarioId)
    .and((comment: any) => comment.deleted_at === null)
    .reverse()
    .limit(5)
    .toArray();

  const summary = {
    shares,
    total_shares: shares.length,
    pending: shares.filter((s: any) => s.status === 'pending').length,
    viewed: shares.filter((s: any) => s.status === 'viewed').length,
    commented: shares.filter((s: any) => s.status === 'commented').length,
    accepted: shares.filter((s: any) => s.status === 'accepted').length,
    declined: shares.filter((s: any) => s.status === 'declined').length,
    latest_comments: comments,
  };

  return summary;
}

/**
 * Helper: Format runway impact for client view
 */
function formatRunwayImpact(
  baselineMonths: number | null,
  projectedMonths: number | null
): string {
  if (baselineMonths === null && projectedMonths === null) {
    return 'No change (cash flow positive)';
  }

  if (baselineMonths === null && projectedMonths !== null) {
    return `Now ${projectedMonths.toFixed(1)} months runway (was cash flow positive)`;
  }

  if (baselineMonths !== null && projectedMonths === null) {
    return 'Becomes cash flow positive';
  }

  if (baselineMonths !== null && projectedMonths !== null) {
    const change = projectedMonths - baselineMonths;
    if (Math.abs(change) < 0.5) {
      return 'No significant change';
    }
    return change > 0
      ? `+${change.toFixed(1)} months runway`
      : `${change.toFixed(1)} months runway`;
  }

  return 'Unable to calculate';
}
