/**
 * Group H E2E Tests - Multi-User Collaboration
 *
 * End-to-end tests for complete multi-user workflows
 *
 * @group e2e
 * @group group-h
 * @group h1
 * @group h2
 * @group h3
 */

import { test, expect } from '@playwright/test';

test.describe('Multi-User Team Collaboration', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@gracefulbooks.test');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
  });

  test('H1: Admin can invite team member', async ({ page }) => {
    // Navigate to team management
    await page.click('[data-testid="settings-menu"]');
    await page.click('[data-testid="team-management-link"]');

    await expect(page).toHaveURL('/settings/team');

    // Click invite button
    await page.click('[data-testid="invite-team-member-button"]');

    // Fill invitation form
    await page.fill('[data-testid="invite-email-input"]', 'manager@gracefulbooks.test');
    await page.selectOption('[data-testid="invite-role-select"]', 'MANAGER');
    await page.fill(
      '[data-testid="invite-message-textarea"]',
      'Welcome to the team! Looking forward to working with you.'
    );

    // Send invitation
    await page.click('[data-testid="send-invitation-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Invitation sent successfully'
    );

    // Verify invitation appears in pending list
    await expect(page.locator('[data-testid="pending-invitations-list"]')).toContainText(
      'manager@gracefulbooks.test'
    );
  });

  test('H1: Team member can accept invitation', async ({ page, context }) => {
    // Step 1: Admin sends invitation (setup)
    await page.goto('/settings/team');
    await page.click('[data-testid="invite-team-member-button"]');
    await page.fill('[data-testid="invite-email-input"]', 'newuser@gracefulbooks.test');
    await page.selectOption('[data-testid="invite-role-select"]', 'BOOKKEEPER');
    await page.click('[data-testid="send-invitation-button"]');

    // Get invitation token from UI or database mock
    const invitationToken = await page.getAttribute(
      '[data-testid="invitation-link"]',
      'data-token'
    );

    // Step 2: New user accepts invitation (new browser context)
    const newUserPage = await context.newPage();
    await newUserPage.goto(`/accept-invitation?token=${invitationToken}`);

    // Fill registration form
    await newUserPage.fill('[data-testid="first-name-input"]', 'Jane');
    await newUserPage.fill('[data-testid="last-name-input"]', 'Smith');
    await newUserPage.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await newUserPage.fill('[data-testid="password-confirm-input"]', 'SecurePassword123!');

    // Accept invitation
    await newUserPage.click('[data-testid="accept-invitation-button"]');

    // Verify redirect to dashboard
    await expect(newUserPage).toHaveURL('/dashboard');

    // Verify welcome message for new team member
    await expect(newUserPage.locator('[data-testid="welcome-message"]')).toContainText(
      'Welcome to the team'
    );

    // Verify role badge
    await expect(newUserPage.locator('[data-testid="user-role-badge"]')).toContainText(
      'Bookkeeper'
    );
  });

  test('H1: Different roles have appropriate access', async ({ page: _page, context }) => {
    // Test as Manager
    const managerPage = await context.newPage();
    await managerPage.goto('/login');
    await managerPage.fill('[data-testid="email-input"]', 'manager@gracefulbooks.test');
    await managerPage.fill('[data-testid="password-input"]', 'TestPassword123!');
    await managerPage.click('[data-testid="login-button"]');

    // Manager can access transactions
    await managerPage.click('[data-testid="transactions-menu"]');
    await expect(managerPage).toHaveURL('/transactions');

    // Manager can create transactions
    await expect(
      managerPage.locator('[data-testid="create-transaction-button"]')
    ).toBeVisible();

    // Manager cannot access team management
    await managerPage.click('[data-testid="settings-menu"]');
    await expect(
      managerPage.locator('[data-testid="team-management-link"]')
    ).not.toBeVisible();

    // Test as Bookkeeper
    const bookkeeperPage = await context.newPage();
    await bookkeeperPage.goto('/login');
    await bookkeeperPage.fill('[data-testid="email-input"]', 'bookkeeper@gracefulbooks.test');
    await bookkeeperPage.fill('[data-testid="password-input"]', 'TestPassword123!');
    await bookkeeperPage.click('[data-testid="login-button"]');

    // Bookkeeper can access transactions
    await bookkeeperPage.click('[data-testid="transactions-menu"]');
    await expect(bookkeeperPage).toHaveURL('/transactions');

    // Bookkeeper cannot access accounts setup
    await bookkeeperPage.click('[data-testid="accounts-menu"]');
    await expect(
      bookkeeperPage.locator('[data-testid="create-account-button"]')
    ).not.toBeVisible();
  });

  test('H2: Admin can rotate encryption keys', async ({ page }) => {
    // Navigate to security settings
    await page.goto('/settings/security');

    // Click key rotation button
    await page.click('[data-testid="rotate-keys-button"]');

    // Confirm rotation
    await page.click('[data-testid="confirm-rotation-button"]');

    // Wait for rotation to complete
    await expect(page.locator('[data-testid="rotation-progress"]')).toBeVisible();

    await page.waitForSelector('[data-testid="rotation-complete-message"]', {
      timeout: 60000, // 60 seconds max
    });

    // Verify success message
    await expect(page.locator('[data-testid="rotation-complete-message"]')).toContainText(
      'Key rotation completed successfully'
    );

    // Verify duration is displayed
    const duration = await page.locator('[data-testid="rotation-duration"]').textContent();
    expect(duration).toBeTruthy();

    // Verify affected users count
    const affectedUsers = await page
      .locator('[data-testid="affected-users-count"]')
      .textContent();
    expect(affectedUsers).toMatch(/\d+ users/);
  });

  test('H2: Admin can revoke user access', async ({ page, context }) => {
    // Navigate to team management
    await page.goto('/settings/team');

    // Find user to revoke
    const userRow = page.locator('[data-testid="team-member-row"]').filter({
      hasText: 'manager@gracefulbooks.test',
    });

    // Click revoke button
    await userRow.locator('[data-testid="revoke-access-button"]').click();

    // Confirm revocation
    await page.fill('[data-testid="revocation-reason-input"]', 'Position eliminated');
    await page.click('[data-testid="confirm-revocation-button"]');

    // Wait for revocation to complete
    await expect(page.locator('[data-testid="revocation-complete-message"]')).toBeVisible({
      timeout: 10000,
    });

    // Verify user shows as inactive
    await expect(userRow.locator('[data-testid="user-status"]')).toContainText('Inactive');

    // Verify revoked user cannot login
    const revokedUserPage = await context.newPage();
    await revokedUserPage.goto('/login');
    await revokedUserPage.fill('[data-testid="email-input"]', 'manager@gracefulbooks.test');
    await revokedUserPage.fill('[data-testid="password-input"]', 'TestPassword123!');
    await revokedUserPage.click('[data-testid="login-button"]');

    // Should see access revoked message
    await expect(revokedUserPage.locator('[data-testid="error-message"]')).toContainText(
      'Your access has been revoked'
    );
  });
});

test.describe('Approval Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@gracefulbooks.test');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL('/dashboard');
  });

  test('H3: Admin can create approval rule', async ({ page }) => {
    // Navigate to approval workflows
    await page.goto('/settings/approvals');

    // Click create rule button
    await page.click('[data-testid="create-approval-rule-button"]');

    // Fill rule form
    await page.fill('[data-testid="rule-name-input"]', 'Large Expense Approval');
    await page.fill('[data-testid="rule-description-input"]', 'Requires approval for expenses over $1000');

    // Select transaction types
    await page.check('[data-testid="transaction-type-expense"]');
    await page.check('[data-testid="transaction-type-bill"]');

    // Add condition: amount > 1000
    await page.click('[data-testid="add-condition-button"]');
    await page.selectOption('[data-testid="condition-field"]', 'amount');
    await page.selectOption('[data-testid="condition-operator"]', 'GREATER_THAN');
    await page.fill('[data-testid="condition-value"]', '1000');

    // Add approval level
    await page.click('[data-testid="add-approval-level-button"]');
    await page.check('[data-testid="approver-role-manager"]');

    // Set expiration
    await page.fill('[data-testid="expires-after-hours"]', '72');

    // Save rule
    await page.click('[data-testid="save-rule-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Approval rule created successfully'
    );

    // Verify rule appears in list
    await expect(page.locator('[data-testid="approval-rules-list"]')).toContainText(
      'Large Expense Approval'
    );
  });

  test('H3: Transaction requiring approval goes through workflow', async ({ page, context }) => {
    // Setup: Create approval rule (as admin)
    await page.goto('/settings/approvals');
    await page.click('[data-testid="create-approval-rule-button"]');
    await page.fill('[data-testid="rule-name-input"]', 'Bill Approval');
    await page.check('[data-testid="transaction-type-bill"]');
    await page.click('[data-testid="add-condition-button"]');
    await page.selectOption('[data-testid="condition-field"]', 'amount');
    await page.selectOption('[data-testid="condition-operator"]', 'GREATER_THAN');
    await page.fill('[data-testid="condition-value"]', '500');
    await page.click('[data-testid="add-approval-level-button"]');
    await page.check('[data-testid="approver-role-admin"]');
    await page.click('[data-testid="save-rule-button"]');

    // Step 1: Bookkeeper creates bill requiring approval
    const bookkeeperPage = await context.newPage();
    await bookkeeperPage.goto('/login');
    await bookkeeperPage.fill('[data-testid="email-input"]', 'bookkeeper@gracefulbooks.test');
    await bookkeeperPage.fill('[data-testid="password-input"]', 'TestPassword123!');
    await bookkeeperPage.click('[data-testid="login-button"]');

    await bookkeeperPage.goto('/bills');
    await bookkeeperPage.click('[data-testid="create-bill-button"]');

    await bookkeeperPage.fill('[data-testid="vendor-input"]', 'Acme Corporation');
    await bookkeeperPage.fill('[data-testid="amount-input"]', '2500.00');
    await bookkeeperPage.fill('[data-testid="description-input"]', 'Office equipment purchase');
    await bookkeeperPage.click('[data-testid="save-bill-button"]');

    // Verify approval required message
    await expect(bookkeeperPage.locator('[data-testid="approval-required-message"]')).toContainText(
      'This bill requires approval'
    );

    // Verify bill shows pending status
    await expect(bookkeeperPage.locator('[data-testid="bill-status"]')).toContainText('Pending Approval');

    // Step 2: Admin receives notification and approves
    await page.goto('/approvals/pending');

    // Find the pending approval
    const approvalItem = page.locator('[data-testid="approval-item"]').filter({
      hasText: 'Acme Corporation',
    });

    await expect(approvalItem).toBeVisible();

    // View details
    await approvalItem.click();

    // Verify details are shown
    await expect(page.locator('[data-testid="approval-amount"]')).toContainText('$2,500.00');
    await expect(page.locator('[data-testid="approval-vendor"]')).toContainText('Acme Corporation');

    // Approve with comment
    await page.fill('[data-testid="approval-comment"]', 'Approved - necessary equipment');
    await page.click('[data-testid="approve-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Bill approved successfully'
    );

    // Step 3: Verify bill is now approved in bookkeeper's view
    await bookkeeperPage.goto('/bills');
    const billRow = bookkeeperPage.locator('[data-testid="bill-row"]').filter({
      hasText: 'Acme Corporation',
    });

    await expect(billRow.locator('[data-testid="bill-status"]')).toContainText('Approved');
  });

  test('H3: Approver can reject transaction', async ({ page, context }) => {
    // Create bill requiring approval (as bookkeeper)
    const bookkeeperPage = await context.newPage();
    await bookkeeperPage.goto('/login');
    await bookkeeperPage.fill('[data-testid="email-input"]', 'bookkeeper@gracefulbooks.test');
    await bookkeeperPage.fill('[data-testid="password-input"]', 'TestPassword123!');
    await bookkeeperPage.click('[data-testid="login-button"]');

    await bookkeeperPage.goto('/expenses');
    await bookkeeperPage.click('[data-testid="create-expense-button"]');
    await bookkeeperPage.fill('[data-testid="amount-input"]', '1500.00');
    await bookkeeperPage.fill('[data-testid="description-input"]', 'Team building event');
    await bookkeeperPage.click('[data-testid="save-expense-button"]');

    // Admin rejects
    await page.goto('/approvals/pending');
    const approvalItem = page.locator('[data-testid="approval-item"]').first();
    await approvalItem.click();

    await page.fill('[data-testid="approval-comment"]', 'Please provide more details and receipts');
    await page.click('[data-testid="reject-button"]');

    // Verify rejection
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Expense rejected'
    );

    // Verify bookkeeper sees rejection
    await bookkeeperPage.goto('/expenses');
    const expenseRow = bookkeeperPage.locator('[data-testid="expense-row"]').first();
    await expect(expenseRow.locator('[data-testid="expense-status"]')).toContainText('Rejected');

    // Bookkeeper can see rejection reason
    await expenseRow.click();
    await expect(bookkeeperPage.locator('[data-testid="rejection-reason"]')).toContainText(
      'Please provide more details and receipts'
    );
  });

  test('H3: Approval delegation works correctly', async ({ page, context }) => {
    // Admin delegates approval to manager
    await page.goto('/settings/approvals/delegation');
    await page.click('[data-testid="create-delegation-button"]');

    await page.selectOption('[data-testid="delegate-to-select"]', 'manager@gracefulbooks.test');
    await page.fill('[data-testid="delegation-reason"]', 'On vacation');

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    await page.fill('[data-testid="start-date-input"]', startDate.toISOString().split('T')[0]);
    await page.fill('[data-testid="end-date-input"]', endDate.toISOString().split('T')[0]);

    await page.click('[data-testid="save-delegation-button"]');

    // Verify delegation created
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Delegation created successfully'
    );

    // Manager should now see delegated approvals
    const managerPage = await context.newPage();
    await managerPage.goto('/login');
    await managerPage.fill('[data-testid="email-input"]', 'manager@gracefulbooks.test');
    await managerPage.fill('[data-testid="password-input"]', 'TestPassword123!');
    await managerPage.click('[data-testid="login-button"]');

    await managerPage.goto('/approvals/pending');

    // Should see delegation notice
    await expect(managerPage.locator('[data-testid="delegation-notice"]')).toContainText(
      'You are approving on behalf of'
    );
  });
});

test.describe('Performance Requirements', () => {
  test('H2: Key rotation completes within 60 seconds', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@gracefulbooks.test');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    await page.goto('/settings/security');

    const startTime = Date.now();

    await page.click('[data-testid="rotate-keys-button"]');
    await page.click('[data-testid="confirm-rotation-button"]');

    await page.waitForSelector('[data-testid="rotation-complete-message"]', {
      timeout: 60000,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(60000); // Must complete in under 60 seconds
  });

  test('H2: Access revocation completes within 10 seconds', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@gracefulbooks.test');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    await page.goto('/settings/team');

    const startTime = Date.now();

    const userRow = page.locator('[data-testid="team-member-row"]').first();
    await userRow.locator('[data-testid="revoke-access-button"]').click();
    await page.fill('[data-testid="revocation-reason-input"]', 'Test revocation');
    await page.click('[data-testid="confirm-revocation-button"]');

    await page.waitForSelector('[data-testid="revocation-complete-message"]', {
      timeout: 10000,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(10000); // Must complete in under 10 seconds
  });
});
