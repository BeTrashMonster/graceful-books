/**
 * TESTING GATE 5.2: Authority Attenuation
 *
 * ALL TESTS MUST PASS TO PROCEED TO SECTION 5.3
 *
 * Tests permission hierarchy, attenuation validation,
 * and delegation token management.
 *
 * @security Phase 5.2 - Authority Attenuation Chain
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  ATTENUATION_CHAIN,
  validateAttenuation,
  validateDelegationChain,
  getScopeForActor,
  isActionAllowedForActor,
  getMaxAmountForActor,
  getTimeLimitForActor,
  type PermissionLevel,
} from '../attenuation';

import {
  createDelegationToken,
  validateDelegationToken,
  useToken,
  revokeToken,
  getToken,
  getDelegationAuditLog,
  clearDelegationStore,
  AttenuationViolationError,
  InsufficientScopeError,
  type DelegationToken,
} from '../delegation';

// ============================================================================
// 5.2.T.1: Attenuation Chain Definition
// ============================================================================

describe('GATE 5.2: Authority Attenuation', () => {
  beforeEach(() => {
    clearDelegationStore();
  });

  describe('5.2.T.1: Attenuation Chain Definition', () => {
    const levels: PermissionLevel[] = ['none', 'minimal', 'limited', 'standard', 'full'];

    it('defines user as highest level', () => {
      expect(ATTENUATION_CHAIN.user.level).toBe('full');
    });

    it('defines application below user', () => {
      const userIndex = levels.indexOf(ATTENUATION_CHAIN.user.level);
      const appIndex = levels.indexOf(ATTENUATION_CHAIN.application.level);
      expect(appIndex).toBeLessThan(userIndex);
    });

    it('defines ai_feature below application', () => {
      const appIndex = levels.indexOf(ATTENUATION_CHAIN.application.level);
      const aiIndex = levels.indexOf(ATTENUATION_CHAIN.ai_feature.level);
      expect(aiIndex).toBeLessThan(appIndex);
    });

    it('defines integration as lowest active level', () => {
      expect(ATTENUATION_CHAIN.integration.level).toBe('minimal');
    });

    it('integration has no write actions', () => {
      const writeActions = ATTENUATION_CHAIN.integration.allowed_actions.filter(
        (a) => a.includes(':write') || a.includes(':create') || a.includes(':delete')
      );
      expect(writeActions).toHaveLength(0);
    });

    it('integration has amount limit of zero', () => {
      expect(ATTENUATION_CHAIN.integration.max_amount_usd).toBe(0);
    });

    it('ai_feature cannot write transactions', () => {
      const writeActions = ATTENUATION_CHAIN.ai_feature.allowed_actions.filter(
        (a) => a === 'transaction:create' || a === 'transaction:update' || a === 'transaction:delete'
      );
      expect(writeActions).toHaveLength(0);
    });

    it('ai_feature can only suggest', () => {
      expect(ATTENUATION_CHAIN.ai_feature.allowed_actions).toContain('transaction:suggest');
      expect(ATTENUATION_CHAIN.ai_feature.allowed_actions).toContain('transaction:read');
    });
  });

  // ============================================================================
  // 5.2.T.2: Attenuation Validation
  // ============================================================================

  describe('5.2.T.2: Attenuation Validation', () => {
    it('allows valid downward delegation', () => {
      const result = validateAttenuation('user', 'application', ['transaction:read']);
      expect(result.valid).toBe(true);
    });

    it('allows delegation to same level', () => {
      const result = validateAttenuation('application', 'application', ['transaction:read']);
      expect(result.valid).toBe(true);
    });

    it('blocks upward escalation', () => {
      const result = validateAttenuation('application', 'user', ['transaction:read']);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('escalate');
    });

    it('blocks integration to application escalation', () => {
      const result = validateAttenuation('integration', 'application', ['transaction:read']);
      expect(result.valid).toBe(false);
    });

    it('blocks actions not in target scope', () => {
      const result = validateAttenuation(
        'application',
        'integration',
        ['transaction:write'] // Integration cannot write
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('allows valid action within scope', () => {
      const result = validateAttenuation(
        'application',
        'ai_feature',
        ['transaction:read', 'transaction:suggest']
      );
      expect(result.valid).toBe(true);
    });

    it('validates unknown source scope', () => {
      const result = validateAttenuation('unknown', 'application', ['transaction:read']);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unknown');
    });

    it('validates unknown target scope', () => {
      const result = validateAttenuation('application', 'unknown', ['transaction:read']);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unknown');
    });
  });

  // ============================================================================
  // 5.2.T.3: Delegation Token Creation
  // ============================================================================

  describe('5.2.T.3: Delegation Token Creation', () => {
    it('creates valid delegation token', async () => {
      const token = await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 3600,
      });

      expect(token.token_id).toBeDefined();
      expect(token.scope).toContain('transaction:read');
      expect(token.delegation_chain).toContain('ai_feature');
      expect(token.signature).toBeDefined();
    });

    it('rejects escalation in token creation', async () => {
      await expect(
        createDelegationToken({
          user_id: 'user-123',
          delegator: 'integration',
          delegate: 'application', // Higher level
          requested_scope: ['transaction:read'],
          resources: ['*'],
          existing_chain: ['user', 'application', 'integration'],
          lifetime_seconds: 3600,
        })
      ).rejects.toThrow(AttenuationViolationError);
    });

    it('rejects scope beyond delegator capability', async () => {
      // AI cannot write, and integration doesn't have write either
      // This will fail at attenuation validation level
      await expect(
        createDelegationToken({
          user_id: 'user-123',
          delegator: 'ai_feature',
          delegate: 'integration',
          requested_scope: ['transaction:write'], // AI cannot write
          resources: ['*'],
          existing_chain: ['user', 'application', 'ai_feature'],
          lifetime_seconds: 3600,
        })
      ).rejects.toThrow(); // Either AttenuationViolationError or InsufficientScopeError
    });

    it('logs delegation to audit trail', async () => {
      await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 3600,
      });

      const logs = getDelegationAuditLog();
      expect(logs.some((log) => log.action === 'create' && log.result === 'success')).toBe(true);
    });

    it('creates token with max_uses constraint', async () => {
      const token = await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 3600,
        max_uses: 10,
      });

      expect(token.max_uses).toBe(10);
      expect(token.current_uses).toBe(0);
    });
  });

  // ============================================================================
  // 5.2.T.4: Delegation Token Validation
  // ============================================================================

  describe('5.2.T.4: Delegation Token Validation', () => {
    let validToken: DelegationToken;

    beforeEach(async () => {
      validToken = await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['txn-*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 3600,
      });
    });

    it('validates correct token usage', async () => {
      const result = await validateDelegationToken(validToken, 'transaction:read', 'txn-123');
      expect(result.valid).toBe(true);
    });

    it('rejects expired tokens', async () => {
      // Create a token that expires immediately
      const shortLivedToken = await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['txn-*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 0, // Expires immediately
      });

      // Wait a tiny bit to ensure it's expired
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await validateDelegationToken(shortLivedToken, 'transaction:read', 'txn-123');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('rejects invalid signatures', async () => {
      const tamperedToken = { ...validToken, signature: 'invalid' };
      const result = await validateDelegationToken(tamperedToken, 'transaction:read', 'txn-123');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('signature');
    });

    it('rejects out-of-scope actions', async () => {
      const result = await validateDelegationToken(
        validToken,
        'transaction:write', // Not in scope
        'txn-123'
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('scope');
    });

    it('rejects out-of-scope resources', async () => {
      const result = await validateDelegationToken(
        validToken,
        'transaction:read',
        'account-123' // Not matching txn-*
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Resource');
    });

    it('enforces max uses', async () => {
      const limitedToken = await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 3600,
        max_uses: 1,
      });

      // Use the token once
      useToken(limitedToken.token_id);

      // Get updated token
      const usedToken = getToken(limitedToken.token_id)!;

      const result = await validateDelegationToken(usedToken, 'transaction:read', 'txn-123');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('uses');
    });

    it('useToken increments use count', () => {
      const initialUses = validToken.current_uses;
      useToken(validToken.token_id);

      const updatedToken = getToken(validToken.token_id)!;
      expect(updatedToken.current_uses).toBe(initialUses + 1);
    });

    it('revokeToken removes token', () => {
      expect(getToken(validToken.token_id)).toBeDefined();

      revokeToken(validToken.token_id, 'admin', 'Security concern');

      expect(getToken(validToken.token_id)).toBeUndefined();
    });
  });

  // ============================================================================
  // 5.2.T.5: Escalation Attack Prevention
  // ============================================================================

  describe('5.2.T.5: Escalation Attack Prevention', () => {
    const ESCALATION_SCENARIOS = [
      {
        name: 'Integration to Application',
        from: 'integration',
        to: 'application',
        scope: ['transaction:read'],
      },
      {
        name: 'AI to Application',
        from: 'ai_feature',
        to: 'application',
        scope: ['transaction:read'],
      },
      {
        name: 'Integration to User',
        from: 'integration',
        to: 'user',
        scope: ['*'],
      },
      {
        name: 'AI acquiring write',
        from: 'ai_feature',
        to: 'ai_feature',
        scope: ['transaction:write'],
      },
      {
        name: 'Integration acquiring create',
        from: 'integration',
        to: 'integration',
        scope: ['transaction:create'],
      },
    ];

    ESCALATION_SCENARIOS.forEach(({ name, from, to, scope }) => {
      it(`blocks escalation: ${name}`, () => {
        const result = validateAttenuation(from, to, scope);
        expect(result.valid).toBe(false);
      });
    });

    it('blocks escalation in delegation chain', () => {
      // Chain goes: user -> app -> integration -> app (escalation!)
      const result = validateDelegationChain(
        ['user', 'application', 'integration', 'application'],
        ['transaction:read']
      );
      expect(result.valid).toBe(false);
    });

    it('allows valid delegation chain', () => {
      // Chain goes user -> application -> ai_feature with transaction:read
      // (ai_feature has transaction:read in its allowed actions)
      const result = validateDelegationChain(
        ['user', 'application', 'ai_feature'],
        ['transaction:read']
      );
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // 5.2.T.6: Helper Functions
  // ============================================================================

  describe('5.2.T.6: Helper Functions', () => {
    it('getScopeForActor returns correct scope', () => {
      const scope = getScopeForActor('ai_feature');
      expect(scope.level).toBe('limited');
      expect(scope.allowed_actions).toContain('transaction:read');
    });

    it('getScopeForActor returns none for unknown', () => {
      const scope = getScopeForActor('unknown');
      expect(scope.level).toBe('none');
      expect(scope.allowed_actions).toHaveLength(0);
    });

    it('isActionAllowedForActor checks correctly', () => {
      expect(isActionAllowedForActor('application', 'transaction:read')).toBe(true);
      expect(isActionAllowedForActor('ai_feature', 'transaction:write')).toBe(false);
      expect(isActionAllowedForActor('integration', 'transaction:read_external')).toBe(true);
    });

    it('getMaxAmountForActor returns correct limits', () => {
      expect(getMaxAmountForActor('integration')).toBe(0);
      expect(getMaxAmountForActor('user')).toBeUndefined();
    });

    it('getTimeLimitForActor returns correct limits', () => {
      expect(getTimeLimitForActor('integration')).toBe(900);
      expect(getTimeLimitForActor('user')).toBeUndefined();
    });
  });

  // ============================================================================
  // 5.2.T.7: Security Invariants
  // ============================================================================

  describe('5.2.T.7: Security Invariants', () => {
    it('INVARIANT: AI cannot write to transactions', () => {
      expect(isActionAllowedForActor('ai_feature', 'transaction:create')).toBe(false);
      expect(isActionAllowedForActor('ai_feature', 'transaction:update')).toBe(false);
      expect(isActionAllowedForActor('ai_feature', 'transaction:delete')).toBe(false);
    });

    it('INVARIANT: Integration has zero amount limit', () => {
      expect(ATTENUATION_CHAIN.integration.max_amount_usd).toBe(0);
    });

    it('INVARIANT: Integration has time limit', () => {
      expect(ATTENUATION_CHAIN.integration.time_limit_seconds).toBeGreaterThan(0);
    });

    it('INVARIANT: Delegation tokens are signed', async () => {
      const token = await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 3600,
      });

      expect(token.signature).toBeDefined();
      expect(token.signature.length).toBeGreaterThan(0);
    });

    it('INVARIANT: Tampered tokens are rejected', async () => {
      const token = await createDelegationToken({
        user_id: 'user-123',
        delegator: 'application',
        delegate: 'ai_feature',
        requested_scope: ['transaction:read'],
        resources: ['*'],
        existing_chain: ['user', 'application'],
        lifetime_seconds: 3600,
      });

      // Tamper with the scope
      const tamperedToken = { ...token, scope: ['transaction:write'] };

      const result = await validateDelegationToken(tamperedToken, 'transaction:write', 'txn-123');
      expect(result.valid).toBe(false);
    });
  });
});
