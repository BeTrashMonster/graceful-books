/**
 * Subscription Manager Component Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscriptionManager } from './SubscriptionManager';
import { db } from '../../db/database';
import type { Subscription } from '../../types/billing.types';

describe('SubscriptionManager', () => {
  const testUserId = 'test-user-sub-1';
  const testCompanyId = 'test-company-1';

  beforeEach(async () => {
    await db.subscriptions.clear();
  });

  afterEach(async () => {
    await db.subscriptions.clear();
  });

  it('should display message when no subscription exists', async () => {
    render(<SubscriptionManager userId={testUserId} />);

    await waitFor(() => {
      expect(
        screen.getByText(/don't have an active subscription/i)
      ).toBeDefined();
    });
  });

  it('should display individual subscription details', async () => {
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      company_id: testCompanyId,
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      subscription_type: 'individual',
      status: 'active',
      current_period_start: Date.now(),
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      client_charge: 0,
      team_member_charge: 0,
      charity_contribution: 500,
      total_amount: 4000,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };

    await db.subscriptions.add(subscription);

    render(<SubscriptionManager userId={testUserId} />);

    await waitFor(() => {
      expect(screen.getByText(/individual/i)).toBeDefined();
      expect(screen.getByText(/\$40\/month/i)).toBeDefined();
    });
  });

  it('should display active status badge', async () => {
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      company_id: testCompanyId,
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      subscription_type: 'individual',
      status: 'active',
      current_period_start: Date.now(),
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      client_charge: 0,
      team_member_charge: 0,
      charity_contribution: 500,
      total_amount: 4000,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };

    await db.subscriptions.add(subscription);

    render(<SubscriptionManager userId={testUserId} />);

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeDefined();
    });
  });

  it('should display past due warning', async () => {
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      company_id: testCompanyId,
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      subscription_type: 'individual',
      status: 'past_due',
      current_period_start: Date.now(),
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      client_charge: 0,
      team_member_charge: 0,
      charity_contribution: 500,
      total_amount: 4000,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };

    await db.subscriptions.add(subscription);

    render(<SubscriptionManager userId={testUserId} />);

    await waitFor(() => {
      expect(screen.getByText(/payment failed/i)).toBeDefined();
    });
  });

  it('should display trial period notice', async () => {
    const trialEnd = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now

    const subscription: Subscription = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      company_id: testCompanyId,
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      subscription_type: 'individual',
      status: 'trialing',
      current_period_start: Date.now(),
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: Date.now(),
      trial_end: trialEnd,
      client_charge: 0,
      team_member_charge: 0,
      charity_contribution: 500,
      total_amount: 4000,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };

    await db.subscriptions.add(subscription);

    render(<SubscriptionManager userId={testUserId} />);

    await waitFor(() => {
      expect(screen.getByText(/trial ends on/i)).toBeDefined();
    });
  });

  it('should show cancel button for active subscription', async () => {
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      company_id: testCompanyId,
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      subscription_type: 'individual',
      status: 'active',
      current_period_start: Date.now(),
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancel_at_period_end: false,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      client_charge: 0,
      team_member_charge: 0,
      charity_contribution: 500,
      total_amount: 4000,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };

    await db.subscriptions.add(subscription);

    render(<SubscriptionManager userId={testUserId} />);

    await waitFor(() => {
      expect(screen.getByText(/cancel subscription/i)).toBeDefined();
    });
  });

  it('should show reactivate button for canceled subscription', async () => {
    const subscription: Subscription = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      company_id: testCompanyId,
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
      subscription_type: 'individual',
      status: 'active',
      current_period_start: Date.now(),
      current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancel_at_period_end: true,
      canceled_at: null,
      trial_start: null,
      trial_end: null,
      client_charge: 0,
      team_member_charge: 0,
      charity_contribution: 500,
      total_amount: 4000,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    };

    await db.subscriptions.add(subscription);

    render(<SubscriptionManager userId={testUserId} />);

    await waitFor(() => {
      expect(screen.getByText(/reactivate subscription/i)).toBeDefined();
    });
  });
});
