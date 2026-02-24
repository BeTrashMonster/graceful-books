/**
 * Session Security Tests
 *
 * Tests for session fingerprinting, rotation, and validation.
 *
 * Task: S5-6: Session Security Hardening
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateSessionFingerprint,
  hashFingerprint,
  createSecureSession,
  validateSessionWithFingerprint,
  rotateSession,
  forceLogout,
  shouldRenewSession,
  updateSessionActivity,
  cleanupExpiredSessions,
  getSessionValidationMessage,
} from './sessionSecurity';
import type {
  SessionMetadata,
  SessionFingerprint,
  SessionRotationRequest,
  ForceLogoutOptions,
} from './sessionSecurity.types';
import { DEFAULT_SESSION_EXPIRATION_CONFIG } from './sessionSecurity.types';

// Mock dependencies
vi.mock('../utils/device', () => ({
  getDeviceId: vi.fn(() => Promise.resolve('test-device-id-123')),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Session Security', () => {
  describe('generateSessionFingerprint', () => {
    it('should generate a fingerprint with all components', async () => {
      const fingerprint = await generateSessionFingerprint();

      expect(fingerprint).toHaveProperty('userAgent');
      expect(fingerprint).toHaveProperty('screenResolution');
      expect(fingerprint).toHaveProperty('timezone');
      expect(fingerprint).toHaveProperty('language');
      expect(fingerprint).toHaveProperty('platform');
      expect(fingerprint).toHaveProperty('canvasFingerprint');
    });

    it('should include navigator.userAgent', async () => {
      const fingerprint = await generateSessionFingerprint();
      expect(fingerprint.userAgent).toBe(navigator.userAgent);
    });

    it('should include screen resolution', async () => {
      const fingerprint = await generateSessionFingerprint();
      expect(fingerprint.screenResolution).toMatch(/^\d+x\d+x\d+$/);
    });

    it('should include timezone', async () => {
      const fingerprint = await generateSessionFingerprint();
      expect(fingerprint.timezone).toBeTruthy();
    });
  });

  describe('hashFingerprint', () => {
    it('should generate a consistent hash for same fingerprint', async () => {
      const fingerprint: SessionFingerprint = {
        userAgent: 'test-agent',
        screenResolution: '1920x1080x24',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'MacIntel',
        canvasFingerprint: 'test-canvas',
      };

      const hash1 = await hashFingerprint(fingerprint);
      const hash2 = await hashFingerprint(fingerprint);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different fingerprints', async () => {
      const fingerprint1: SessionFingerprint = {
        userAgent: 'test-agent-1',
        screenResolution: '1920x1080x24',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'MacIntel',
        canvasFingerprint: 'test-canvas',
      };

      const fingerprint2: SessionFingerprint = {
        ...fingerprint1,
        userAgent: 'test-agent-2',
      };

      const hash1 = await hashFingerprint(fingerprint1);
      const hash2 = await hashFingerprint(fingerprint2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate a 64-character hex hash', async () => {
      const fingerprint: SessionFingerprint = {
        userAgent: 'test',
        screenResolution: '1920x1080x24',
        timezone: 'UTC',
        language: 'en',
        platform: 'test',
        canvasFingerprint: 'test',
      };

      const hash = await hashFingerprint(fingerprint);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('createSecureSession', () => {
    it('should create a session with all required fields', async () => {
      const session = await createSecureSession(
        'user-123',
        'company-456',
        'OWNER',
        'test-token-789'
      );

      expect(session).toMatchObject({
        user_id: 'user-123',
        company_id: 'company-456',
        role: 'OWNER',
        token: 'test-token-789',
        is_active: true,
        revoked_at: null,
      });
      expect(session.id).toBeTruthy();
      expect(session.device_id).toBe('test-device-id-123');
      expect(session.device_fingerprint).toBeTruthy();
    });

    it('should set expiration based on config', async () => {
      const config = {
        ...DEFAULT_SESSION_EXPIRATION_CONFIG,
        defaultExpirationMs: 1000 * 60 * 60, // 1 hour
      };

      const session = await createSecureSession(
        'user-123',
        'company-456',
        'OWNER',
        'token',
        config
      );

      const expectedExpiration = session.created_at + config.defaultExpirationMs;
      expect(session.expires_at).toBe(expectedExpiration);
    });

    it('should initialize version vector', async () => {
      const session = await createSecureSession(
        'user-123',
        'company-456',
        'OWNER',
        'token'
      );

      expect(session.version_vector).toBeDefined();
      expect(session.version_vector['test-device-id-123']).toBe(1);
    });
  });

  describe('validateSessionWithFingerprint', () => {
    let mockSession: SessionMetadata;

    beforeEach(async () => {
      const fingerprint = await generateSessionFingerprint();
      const fingerprintHash = await hashFingerprint(fingerprint);

      mockSession = {
        id: 'session-123',
        user_id: 'user-123',
        company_id: 'company-456',
        token: 'token-123',
        device_id: 'device-123',
        device_fingerprint: fingerprintHash,
        user_agent: navigator.userAgent,
        ip_address: null,
        device_name: null,
        created_at: Date.now() - 1000 * 60 * 60, // 1 hour ago
        expires_at: Date.now() + 1000 * 60 * 60, // 1 hour from now
        last_activity_at: Date.now(),
        role: 'OWNER',
        remember_device: false,
        is_active: true,
        revoked_at: null,
        version_vector: { 'device-123': 1 },
      };
    });

    it('should validate a valid session with matching fingerprint', async () => {
      const result = await validateSessionWithFingerprint(
        mockSession.id,
        mockSession.token,
        [mockSession]
      );

      expect(result.isValid).toBe(true);
      expect(result.session).toEqual(mockSession);
    });

    it('should reject session that does not exist', async () => {
      const result = await validateSessionWithFingerprint(
        'non-existent',
        'token',
        [mockSession]
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should reject revoked session', async () => {
      const revokedSession = {
        ...mockSession,
        is_active: false,
        revoked_at: Date.now(),
      };

      const result = await validateSessionWithFingerprint(
        revokedSession.id,
        revokedSession.token,
        [revokedSession]
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('revoked');
    });

    it('should reject expired session', async () => {
      const expiredSession = {
        ...mockSession,
        expires_at: Date.now() - 1000, // Expired 1 second ago
      };

      const result = await validateSessionWithFingerprint(
        expiredSession.id,
        expiredSession.token,
        [expiredSession]
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('expired');
    });

    it('should reject session with mismatched fingerprint', async () => {
      const mismatchedSession = {
        ...mockSession,
        device_fingerprint: 'different-fingerprint-hash',
      };

      const result = await validateSessionWithFingerprint(
        mismatchedSession.id,
        mismatchedSession.token,
        [mismatchedSession]
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('fingerprint_mismatch');
    });
  });

  describe('rotateSession', () => {
    let mockSession: SessionMetadata;

    beforeEach(() => {
      mockSession = {
        id: 'session-123',
        user_id: 'user-123',
        company_id: 'company-456',
        token: 'old-token',
        device_id: 'device-123',
        device_fingerprint: 'fingerprint',
        user_agent: navigator.userAgent,
        ip_address: null,
        device_name: null,
        created_at: Date.now() - 1000 * 60 * 60,
        expires_at: Date.now() + 1000 * 60 * 60,
        last_activity_at: Date.now(),
        role: 'OWNER',
        remember_device: false,
        is_active: true,
        revoked_at: null,
        version_vector: { 'device-123': 1 },
      };
    });

    it('should create a new session with new token', async () => {
      const request: SessionRotationRequest = {
        sessionId: mockSession.id,
        reason: 'privilege_change',
        newRole: 'ADMIN',
      };

      const result = await rotateSession(request, mockSession);

      expect(result.success).toBe(true);
      expect(result.newToken).toBeTruthy();
      expect(result.newToken).not.toBe(mockSession.token);
      expect(result.newSessionId).toBeTruthy();
      expect(result.newSessionId).not.toBe(mockSession.id);
    });

    it('should use newRole if provided', async () => {
      const request: SessionRotationRequest = {
        sessionId: mockSession.id,
        reason: 'privilege_change',
        newRole: 'ADMIN',
      };

      const result = await rotateSession(request, mockSession);

      expect(result.success).toBe(true);
    });

    it('should maintain current role if newRole not provided', async () => {
      const request: SessionRotationRequest = {
        sessionId: mockSession.id,
        reason: 'manual_renewal',
      };

      const result = await rotateSession(request, mockSession);

      expect(result.success).toBe(true);
    });

    it('should set new expiration', async () => {
      const request: SessionRotationRequest = {
        sessionId: mockSession.id,
        reason: 'security_event',
      };

      const result = await rotateSession(request, mockSession);

      expect(result.success).toBe(true);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('forceLogout', () => {
    let mockSessions: SessionMetadata[];

    beforeEach(() => {
      mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-123',
          company_id: 'company-456',
          token: 'token-1',
          device_id: 'device-1',
          device_fingerprint: 'fp-1',
          user_agent: 'Browser 1',
          ip_address: null,
          device_name: null,
          created_at: Date.now(),
          expires_at: Date.now() + 1000 * 60 * 60,
          last_activity_at: Date.now(),
          role: 'OWNER',
          remember_device: false,
          is_active: true,
          revoked_at: null,
          version_vector: {},
        },
        {
          id: 'session-2',
          user_id: 'user-123',
          company_id: 'company-456',
          token: 'token-2',
          device_id: 'device-2',
          device_fingerprint: 'fp-2',
          user_agent: 'Browser 2',
          ip_address: null,
          device_name: null,
          created_at: Date.now(),
          expires_at: Date.now() + 1000 * 60 * 60,
          last_activity_at: Date.now(),
          role: 'OWNER',
          remember_device: false,
          is_active: true,
          revoked_at: null,
          version_vector: {},
        },
      ];
    });

    it('should logout all devices', async () => {
      const options: ForceLogoutOptions = {
        userId: 'user-123',
        allDevices: true,
        reason: 'user_initiated',
      };

      const result = await forceLogout(options, mockSessions);

      expect(result.success).toBe(true);
      expect(result.sessionsRevoked).toBe(2);
      expect(mockSessions.every((s) => !s.is_active)).toBe(true);
    });

    it('should logout specific sessions', async () => {
      const options: ForceLogoutOptions = {
        userId: 'user-123',
        allDevices: false,
        sessionIds: ['session-1'],
        reason: 'user_initiated',
      };

      const result = await forceLogout(options, mockSessions);

      expect(result.success).toBe(true);
      expect(result.sessionsRevoked).toBe(1);
      expect(mockSessions[0].is_active).toBe(false);
      expect(mockSessions[1].is_active).toBe(true);
    });

    it('should set revoked_at timestamp', async () => {
      const beforeRevoke = Date.now();

      const options: ForceLogoutOptions = {
        userId: 'user-123',
        allDevices: true,
        reason: 'security_event',
      };

      await forceLogout(options, mockSessions);

      mockSessions.forEach((session) => {
        expect(session.revoked_at).not.toBeNull();
        if (session.revoked_at !== null) {
          expect(session.revoked_at).toBeGreaterThanOrEqual(beforeRevoke);
        }
      });
    });

    it('should return error if neither allDevices nor sessionIds provided', async () => {
      const options: ForceLogoutOptions = {
        userId: 'user-123',
        allDevices: false,
        reason: 'user_initiated',
      };

      const result = await forceLogout(options, mockSessions);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('shouldRenewSession', () => {
    it('should return true if within renewal threshold', () => {
      const config = {
        ...DEFAULT_SESSION_EXPIRATION_CONFIG,
        renewalThresholdMs: 1000 * 60 * 60, // 1 hour
        autoRenew: true,
      };

      const session: SessionMetadata = {
        id: 'session-123',
        user_id: 'user-123',
        company_id: null,
        token: 'token',
        device_id: 'device',
        device_fingerprint: 'fp',
        user_agent: null,
        ip_address: null,
        device_name: null,
        created_at: Date.now() - 1000 * 60 * 60,
        expires_at: Date.now() + 1000 * 60 * 30, // 30 minutes from now
        last_activity_at: Date.now(),
        role: 'OWNER',
        remember_device: false,
        is_active: true,
        revoked_at: null,
        version_vector: {},
      };

      expect(shouldRenewSession(session, config)).toBe(true);
    });

    it('should return false if outside renewal threshold', () => {
      const config = {
        ...DEFAULT_SESSION_EXPIRATION_CONFIG,
        renewalThresholdMs: 1000 * 60 * 60, // 1 hour
        autoRenew: true,
      };

      const session: SessionMetadata = {
        id: 'session-123',
        user_id: 'user-123',
        company_id: null,
        token: 'token',
        device_id: 'device',
        device_fingerprint: 'fp',
        user_agent: null,
        ip_address: null,
        device_name: null,
        created_at: Date.now() - 1000 * 60 * 60,
        expires_at: Date.now() + 1000 * 60 * 90, // 90 minutes from now
        last_activity_at: Date.now(),
        role: 'OWNER',
        remember_device: false,
        is_active: true,
        revoked_at: null,
        version_vector: {},
      };

      expect(shouldRenewSession(session, config)).toBe(false);
    });

    it('should return false if autoRenew is disabled', () => {
      const config = {
        ...DEFAULT_SESSION_EXPIRATION_CONFIG,
        autoRenew: false,
      };

      const session: SessionMetadata = {
        id: 'session-123',
        user_id: 'user-123',
        company_id: null,
        token: 'token',
        device_id: 'device',
        device_fingerprint: 'fp',
        user_agent: null,
        ip_address: null,
        device_name: null,
        created_at: Date.now(),
        expires_at: Date.now() + 1000,
        last_activity_at: Date.now(),
        role: 'OWNER',
        remember_device: false,
        is_active: true,
        revoked_at: null,
        version_vector: {},
      };

      expect(shouldRenewSession(session, config)).toBe(false);
    });
  });

  describe('updateSessionActivity', () => {
    it('should update last_activity_at', () => {
      const session: SessionMetadata = {
        id: 'session-123',
        user_id: 'user-123',
        company_id: null,
        token: 'token',
        device_id: 'device',
        device_fingerprint: 'fp',
        user_agent: null,
        ip_address: null,
        device_name: null,
        created_at: Date.now() - 1000 * 60 * 60,
        expires_at: Date.now() + 1000 * 60 * 60,
        last_activity_at: Date.now() - 1000 * 60, // 1 minute ago
        role: 'OWNER',
        remember_device: false,
        is_active: true,
        revoked_at: null,
        version_vector: {},
      };

      const updated = updateSessionActivity(session);

      expect(updated.last_activity_at).toBeGreaterThan(session.last_activity_at);
    });

    it('should not update if idle timeout exceeded', () => {
      const config = {
        ...DEFAULT_SESSION_EXPIRATION_CONFIG,
        idleTimeoutMs: 1000 * 60 * 30, // 30 minutes
      };

      const session: SessionMetadata = {
        id: 'session-123',
        user_id: 'user-123',
        company_id: null,
        token: 'token',
        device_id: 'device',
        device_fingerprint: 'fp',
        user_agent: null,
        ip_address: null,
        device_name: null,
        created_at: Date.now() - 1000 * 60 * 60,
        expires_at: Date.now() + 1000 * 60 * 60,
        last_activity_at: Date.now() - 1000 * 60 * 60, // 1 hour ago (exceeds idle timeout)
        role: 'OWNER',
        remember_device: false,
        is_active: true,
        revoked_at: null,
        version_vector: {},
      };

      const updated = updateSessionActivity(session, config);

      // Should not update if idle timeout exceeded
      expect(updated.last_activity_at).toBe(session.last_activity_at);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      const sessions: SessionMetadata[] = [
        {
          id: 'session-1',
          user_id: 'user-123',
          company_id: null,
          token: 'token-1',
          device_id: 'device-1',
          device_fingerprint: 'fp-1',
          user_agent: null,
          ip_address: null,
          device_name: null,
          created_at: Date.now() - 1000 * 60 * 60,
          expires_at: Date.now() - 1000, // Expired
          last_activity_at: Date.now(),
          role: 'OWNER',
          remember_device: false,
          is_active: true,
          revoked_at: null,
          version_vector: {},
        },
        {
          id: 'session-2',
          user_id: 'user-123',
          company_id: null,
          token: 'token-2',
          device_id: 'device-2',
          device_fingerprint: 'fp-2',
          user_agent: null,
          ip_address: null,
          device_name: null,
          created_at: Date.now(),
          expires_at: Date.now() + 1000 * 60 * 60, // Active
          last_activity_at: Date.now(),
          role: 'OWNER',
          remember_device: false,
          is_active: true,
          revoked_at: null,
          version_vector: {},
        },
      ];

      const active = cleanupExpiredSessions(sessions);

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('session-2');
    });

    it('should remove revoked sessions', () => {
      const sessions: SessionMetadata[] = [
        {
          id: 'session-1',
          user_id: 'user-123',
          company_id: null,
          token: 'token-1',
          device_id: 'device-1',
          device_fingerprint: 'fp-1',
          user_agent: null,
          ip_address: null,
          device_name: null,
          created_at: Date.now(),
          expires_at: Date.now() + 1000 * 60 * 60,
          last_activity_at: Date.now(),
          role: 'OWNER',
          remember_device: false,
          is_active: false,
          revoked_at: Date.now(),
          version_vector: {},
        },
      ];

      const active = cleanupExpiredSessions(sessions);

      expect(active).toHaveLength(0);
    });
  });

  describe('getSessionValidationMessage', () => {
    it('should return friendly message for expired session', () => {
      const message = getSessionValidationMessage('expired');
      expect(message).toContain('expired');
      expect(message).toContain('sign in again');
    });

    it('should return friendly message for revoked session', () => {
      const message = getSessionValidationMessage('revoked');
      expect(message).toContain('no longer active');
    });

    it('should return friendly message for fingerprint mismatch', () => {
      const message = getSessionValidationMessage('fingerprint_mismatch');
      expect(message).toContain('unusual activity');
      expect(message).toContain('security');
    });

    it('should return friendly message for not found', () => {
      const message = getSessionValidationMessage('not_found');
      expect(message).toContain('not found');
    });

    it('should return default message for unknown reason', () => {
      const message = getSessionValidationMessage(undefined);
      expect(message).toContain('validation failed');
    });
  });
});
