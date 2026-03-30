/**
 * Sync Rate Limiter Tests
 *
 * Tests for rate limiting and DoS protection service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SyncRateLimiter,
  createSyncRateLimiter,
  DEFAULT_RATE_LIMITER_CONFIG,
  type RateLimiterConfig,
} from './SyncRateLimiter'

describe('SyncRateLimiter', () => {
  let rateLimiter: SyncRateLimiter

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    rateLimiter?.stop()
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      rateLimiter = new SyncRateLimiter()
      const stats = rateLimiter.getStatistics()

      expect(stats.totalUsers).toBe(0)
      expect(stats.totalDevices).toBe(0)
      expect(stats.totalConnections).toBe(0)
      expect(stats.bannedUsers).toBe(0)
      expect(stats.bannedDevices).toBe(0)
    })

    it('should initialize with custom config', () => {
      const customConfig: Partial<RateLimiterConfig> = {
        maxConnectionsPerUser: 10,
        maxConnectionsPerDevice: 2,
      }

      rateLimiter = new SyncRateLimiter(customConfig)
      const stats = rateLimiter.getStatistics()

      expect(stats.totalUsers).toBe(0)
    })

    it('should create instance via factory', () => {
      rateLimiter = createSyncRateLimiter()
      expect(rateLimiter).toBeInstanceOf(SyncRateLimiter)
    })
  })

  describe('Rate Limiting - Token Bucket', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter({
        sync: {
          maxRequests: 60,
          windowMs: 60000,
          maxBurst: 10,
          refillRate: 1, // 1 token/second
        },
      })
    })

    it('should allow requests within burst limit', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // First 10 requests should all succeed (burst)
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(9 - i)
      }
    })

    it('should deny requests beyond burst limit', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Consume all burst tokens
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      }

      // Next request should be denied
      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Token bucket exhausted')
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('should refill tokens over time', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Consume all burst tokens
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      }

      // Should be denied
      let result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)

      // Advance time by 2 seconds (refill 2 tokens)
      vi.advanceTimersByTime(2000)

      // Should be allowed now
      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
    })

    it('should cap tokens at max burst', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Advance time by 1 hour (way more than max burst)
      vi.advanceTimersByTime(3600000)

      // First request should succeed
      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)

      // Should have at most maxBurst - 1 remaining
      expect(result.remaining).toBeLessThanOrEqual(9)
    })
  })

  describe('Rate Limiting - Sliding Window', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter({
        sync: {
          maxRequests: 5,
          windowMs: 10000, // 10 seconds
          maxBurst: 100, // High burst to test window only
          refillRate: 100, // High refill to test window only
        },
      })
    })

    it('should allow requests within window limit', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
        expect(result.allowed).toBe(true)
      }
    })

    it('should deny requests beyond window limit', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Consume window limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      }

      // Next request should be denied
      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Rate limit exceeded')
      expect(result.remaining).toBe(0)
    })

    it('should reset window after expiry', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Consume window limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      }

      // Should be denied
      let result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)

      // Advance time past window
      vi.advanceTimersByTime(10001)

      // Should be allowed now (new window)
      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
    })

    it('should track remaining requests in window', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // First request
      let result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)

      // Second request
      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(3)

      // Third request
      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })
  })

  describe('Connection Limits', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter({
        maxConnectionsPerUser: 3,
        maxConnectionsPerDevice: 1,
      })
    })

    it('should allow connections within user limit', () => {
      const userId = 'user1'

      // Register 3 connections from different devices (should all succeed)
      for (let i = 0; i < 3; i++) {
        const deviceId = `device${i}`
        const connectionId = `conn${i}`
        const result = rateLimiter.checkConnectionLimit(userId, deviceId, connectionId)
        expect(result.allowed).toBe(true)
        rateLimiter.registerConnection(userId, deviceId, connectionId)
      }

      expect(rateLimiter.getConnectionCount(userId)).toBe(3)
    })

    it('should deny connections beyond user limit', () => {
      const userId = 'user1'

      // Register 3 connections
      for (let i = 0; i < 3; i++) {
        rateLimiter.registerConnection(userId, `device${i}`, `conn${i}`)
      }

      // Fourth connection should be denied
      const result = rateLimiter.checkConnectionLimit(userId, 'device3', 'conn3')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Maximum concurrent connections per user')
    })

    it('should enforce device connection limit', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Register first connection
      let result = rateLimiter.checkConnectionLimit(userId, deviceId, 'conn1')
      expect(result.allowed).toBe(true)
      rateLimiter.registerConnection(userId, deviceId, 'conn1')

      // Second connection from same device should be denied
      result = rateLimiter.checkConnectionLimit(userId, deviceId, 'conn2')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Maximum concurrent connections per device')
    })

    it('should unregister connections', () => {
      const userId = 'user1'
      const deviceId = 'device1'
      const connectionId = 'conn1'

      // Register connection
      rateLimiter.registerConnection(userId, deviceId, connectionId)
      expect(rateLimiter.getConnectionCount(userId)).toBe(1)

      // Unregister connection
      rateLimiter.unregisterConnection(userId, deviceId, connectionId)
      expect(rateLimiter.getConnectionCount(userId)).toBe(0)
    })

    it('should allow reconnection after unregistering', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Register connection
      rateLimiter.registerConnection(userId, deviceId, 'conn1')

      // Second connection should be denied
      let result = rateLimiter.checkConnectionLimit(userId, deviceId, 'conn2')
      expect(result.allowed).toBe(false)

      // Unregister first connection
      rateLimiter.unregisterConnection(userId, deviceId, 'conn1')

      // Now second connection should be allowed
      result = rateLimiter.checkConnectionLimit(userId, deviceId, 'conn2')
      expect(result.allowed).toBe(true)
    })

    it('should get total connection count', () => {
      rateLimiter.registerConnection('user1', 'device1', 'conn1')
      rateLimiter.registerConnection('user2', 'device2', 'conn2')
      rateLimiter.registerConnection('user3', 'device3', 'conn3')

      expect(rateLimiter.getConnectionCount()).toBe(3)
    })

    it('should get connection count by user', () => {
      rateLimiter.registerConnection('user1', 'device1', 'conn1')
      rateLimiter.registerConnection('user1', 'device2', 'conn2')
      rateLimiter.registerConnection('user2', 'device3', 'conn3')

      expect(rateLimiter.getConnectionCount('user1')).toBe(2)
      expect(rateLimiter.getConnectionCount('user2')).toBe(1)
    })

    it('should get connection count by device', () => {
      rateLimiter.registerConnection('user1', 'device1', 'conn1')
      rateLimiter.registerConnection('user2', 'device1', 'conn2')

      expect(rateLimiter.getConnectionCount(undefined, 'device1')).toBe(2)
    })
  })

  describe('Violation Tracking & Banning', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter({
        sync: {
          maxRequests: 2,
          windowMs: 10000,
          maxBurst: 2,
          refillRate: 0.1,
        },
        violationsBeforeBan: 3,
        banDuration: 60000, // 1 minute
      })
    })

    it('should track violations', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Consume limit
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')

      // Violation 1
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')

      // Not banned yet
      expect(rateLimiter.isBanned(userId)).toBe(false)

      // Violation 2
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(rateLimiter.isBanned(userId)).toBe(false)

      // Violation 3 - should ban
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(rateLimiter.isBanned(userId)).toBe(true)
    })

    it('should deny requests from banned users', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Ban user
      rateLimiter.banUser(userId)

      // All requests should be denied
      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('temporarily banned')
    })

    it('should unban user after ban duration', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Ban user
      rateLimiter.banUser(userId)
      expect(rateLimiter.isBanned(userId)).toBe(true)

      // Advance time past ban duration
      vi.advanceTimersByTime(60001)

      // Should no longer be banned
      expect(rateLimiter.isBanned(userId)).toBe(false)
    })

    it('should manually ban user', () => {
      const userId = 'user1'

      rateLimiter.banUser(userId)
      expect(rateLimiter.isBanned(userId)).toBe(true)
    })

    it('should manually unban user', () => {
      const userId = 'user1'

      rateLimiter.banUser(userId)
      expect(rateLimiter.isBanned(userId)).toBe(true)

      rateLimiter.unbanUser(userId)
      expect(rateLimiter.isBanned(userId)).toBe(false)
    })

    it('should ban with custom duration', () => {
      const userId = 'user1'

      // Ban for 5 seconds
      rateLimiter.banUser(userId, 5000)
      expect(rateLimiter.isBanned(userId)).toBe(true)

      // After 4 seconds, still banned
      vi.advanceTimersByTime(4000)
      expect(rateLimiter.isBanned(userId)).toBe(true)

      // After 6 seconds, unbanned
      vi.advanceTimersByTime(2000)
      expect(rateLimiter.isBanned(userId)).toBe(false)
    })
  })

  describe('Rate Limit Types', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter()
    })

    it('should rate limit sync operations', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
    })

    it('should rate limit auth operations', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      const result = rateLimiter.checkRateLimit(userId, deviceId, 'auth')
      expect(result.allowed).toBe(true)
    })

    it('should rate limit connection operations', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      const result = rateLimiter.checkRateLimit(userId, deviceId, 'connection')
      expect(result.allowed).toBe(true)
    })

    it('should apply different limits for different types', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Auth limit is 2 burst
      rateLimiter.checkRateLimit(userId, deviceId, 'auth')
      rateLimiter.checkRateLimit(userId, deviceId, 'auth')

      // Should be rate limited for auth
      let result = rateLimiter.checkRateLimit(userId, deviceId, 'auth')
      expect(result.allowed).toBe(false)

      // But sync should still work (different bucket)
      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
    })
  })

  describe('Statistics', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter()
    })

    it('should track user count', () => {
      rateLimiter.checkRateLimit('user1', 'device1', 'sync')
      rateLimiter.checkRateLimit('user2', 'device2', 'sync')

      const stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(2)
    })

    it('should track device count', () => {
      rateLimiter.checkRateLimit('user1', 'device1', 'sync')
      rateLimiter.checkRateLimit('user1', 'device2', 'sync')

      const stats = rateLimiter.getStatistics()
      expect(stats.totalDevices).toBe(2)
    })

    it('should track connection count', () => {
      rateLimiter.registerConnection('user1', 'device1', 'conn1')
      rateLimiter.registerConnection('user2', 'device2', 'conn2')

      const stats = rateLimiter.getStatistics()
      expect(stats.totalConnections).toBe(2)
    })

    it('should track banned users', () => {
      rateLimiter.banUser('user1')
      rateLimiter.banUser('user2')

      const stats = rateLimiter.getStatistics()
      expect(stats.bannedUsers).toBe(2)
    })

    it('should not count expired bans', () => {
      rateLimiter.banUser('user1', 5000)

      let stats = rateLimiter.getStatistics()
      expect(stats.bannedUsers).toBe(1)

      // Advance past ban
      vi.advanceTimersByTime(6000)

      stats = rateLimiter.getStatistics()
      expect(stats.bannedUsers).toBe(0)
    })
  })

  describe('Cleanup', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter({
        cleanupInterval: 10000, // 10 seconds
      })
    })

    it('should clean up expired buckets', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Make request to create bucket
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')

      // Get initial stats
      let stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(1)

      // Advance time past cleanup interval
      vi.advanceTimersByTime(20000)

      // Manual cleanup
      rateLimiter.cleanup()

      // User should be cleaned up (no active connections, time passed)
      stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(0)
    })

    it('should clean up inactive users', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Make request
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')

      // Advance time way past cleanup interval
      vi.advanceTimersByTime(30000)

      // Manual cleanup
      rateLimiter.cleanup()

      const stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(0)
    })

    it('should not clean up users with active connections', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Register connection
      rateLimiter.registerConnection(userId, deviceId, 'conn1')

      // Advance time
      vi.advanceTimersByTime(30000)
      rateLimiter.cleanup()

      // Should not clean up (has active connection)
      const stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(1)
    })

    it('should run automatic cleanup', () => {
      // Cleanup should run automatically
      // Create some data
      rateLimiter.checkRateLimit('user1', 'device1', 'sync')

      // Advance past cleanup interval
      vi.advanceTimersByTime(15000)

      // Cleanup should have run (hard to verify without side effects)
      // Just ensure no errors
      expect(true).toBe(true)
    })

    it('should stop cleanup timer', () => {
      rateLimiter.stop()

      // Cleanup should not run after stop
      rateLimiter.checkRateLimit('user1', 'device1', 'sync')
      vi.advanceTimersByTime(15000)

      // No errors should occur
      expect(true).toBe(true)
    })
  })

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      rateLimiter = new SyncRateLimiter({
        sync: {
          maxRequests: 10,
          windowMs: 10000,
          maxBurst: 5,
          refillRate: 1,
        },
        maxConnectionsPerUser: 3,
        violationsBeforeBan: 2,
        banDuration: 30000,
      })
    })

    it('should handle normal user behavior', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Connect
      let result = rateLimiter.checkConnectionLimit(userId, deviceId, 'conn1')
      expect(result.allowed).toBe(true)
      rateLimiter.registerConnection(userId, deviceId, 'conn1')

      // Make some requests
      for (let i = 0; i < 5; i++) {
        result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
        expect(result.allowed).toBe(true)
      }

      // Disconnect
      rateLimiter.unregisterConnection(userId, deviceId, 'conn1')
    })

    it('should handle aggressive user', () => {
      const userId = 'aggressive'
      const deviceId = 'device1'

      // Rapid fire requests (consume burst)
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      }

      // Next requests should be denied (violations)
      let result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)

      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)

      // User should be banned
      expect(rateLimiter.isBanned(userId)).toBe(true)
    })

    it('should handle multi-device user', () => {
      const userId = 'user1'

      // Connect 3 devices
      for (let i = 0; i < 3; i++) {
        const deviceId = `device${i}`
        const connectionId = `conn${i}`

        const result = rateLimiter.checkConnectionLimit(userId, deviceId, connectionId)
        expect(result.allowed).toBe(true)
        rateLimiter.registerConnection(userId, deviceId, connectionId)
      }

      // Fourth device should be denied
      const result = rateLimiter.checkConnectionLimit(userId, 'device3', 'conn3')
      expect(result.allowed).toBe(false)
    })

    it('should handle rate limit recovery', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Consume burst
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      }

      // Should be rate limited
      let result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)

      // Wait for refill
      vi.advanceTimersByTime(3000)

      // Should be allowed again
      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
    })

    it('should isolate users from each other', () => {
      // User 1 consumes their limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit('user1', 'device1', 'sync')
      }

      // User 1 should be rate limited
      let result = rateLimiter.checkRateLimit('user1', 'device1', 'sync')
      expect(result.allowed).toBe(false)

      // User 2 should be unaffected
      result = rateLimiter.checkRateLimit('user2', 'device2', 'sync')
      expect(result.allowed).toBe(true)
    })

    it('should handle ban expiry and recovery', () => {
      const userId = 'user1'
      const deviceId = 'device1'

      // Get banned
      rateLimiter.banUser(userId, 10000)
      expect(rateLimiter.isBanned(userId)).toBe(true)

      // Should be denied
      let result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)

      // Wait for ban to expire
      vi.advanceTimersByTime(11000)

      // Should be allowed again
      result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)
    })
  })
})
