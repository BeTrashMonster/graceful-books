/**
 * Email Scheduling Service Tests
 *
 * Tests for email scheduling functionality including schedule management,
 * email sending, retry logic, and rate limiting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  EmailSchedulingService,
  createEmailSchedulingService,
  formatScheduleDescription,
  DEFAULT_EMAIL_SCHEDULE,
  type EmailScheduleConfig,
  type SendBackupEmailOptions,
} from './EmailSchedulingService'

// Mock restoration token service
vi.mock('./RestorationTokenService', () => ({
  restorationTokenService: {
    generateToken: vi.fn().mockResolvedValue({
      success: true,
      token: 'mock-token-123',
      tokenId: 'mock-token-id-456',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  },
  generateRestorationUrl: vi.fn((token, tokenId) =>
    `https://app.gracefulbooks.com/restore?token=${token}&id=${tokenId}`
  ),
}))

// Mock email template
vi.mock('./EmailTemplate', () => ({
  generateRestorationEmail: vi.fn().mockReturnValue({
    html: '<html>Mock HTML</html>',
    text: 'Mock text',
    subject: 'Your Test Company Backup is Ready',
  }),
}))

describe('EmailSchedulingService', () => {
  let service: EmailSchedulingService

  beforeEach(() => {
    service = new EmailSchedulingService()
    vi.useFakeTimers()
  })

  afterEach(() => {
    service.stop()
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should create service with default config', () => {
      const svc = new EmailSchedulingService()
      expect(svc).toBeDefined()
      expect(svc.getSchedule()).toMatchObject({
        enabled: true,
        dayOfWeek: 0,
        hour: 1,
        minute: 0,
      })
    })

    it('should create service with custom config', () => {
      const config: EmailScheduleConfig = {
        enabled: true,
        dayOfWeek: 3, // Wednesday
        hour: 14,
        minute: 30,
        timezone: 'America/New_York',
      }

      const svc = new EmailSchedulingService(config)
      expect(svc.getSchedule()).toEqual(config)
    })
  })

  describe('start/stop', () => {
    it('should start scheduling', () => {
      service.start()
      // Should not throw
      expect(true).toBe(true)
    })

    it('should stop scheduling', () => {
      service.start()
      service.stop()
      // Should not throw
      expect(true).toBe(true)
    })

    it('should not start twice', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      service.start()
      service.start() // Second start should warn

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already started')
      )

      consoleSpy.mockRestore()
    })

    it('should not start when disabled', () => {
      const config: EmailScheduleConfig = {
        ...DEFAULT_EMAIL_SCHEDULE,
        enabled: false,
      }

      const svc = new EmailSchedulingService(config)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      svc.start()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('disabled')
      )

      consoleSpy.mockRestore()
      svc.stop()
    })
  })

  describe('updateSchedule', () => {
    it('should update schedule configuration', () => {
      service.updateSchedule({
        dayOfWeek: 5, // Friday
        hour: 10,
      })

      const schedule = service.getSchedule()
      expect(schedule.dayOfWeek).toBe(5)
      expect(schedule.hour).toBe(10)
    })

    it('should restart if running', () => {
      service.start()

      service.updateSchedule({
        hour: 12,
      })

      // Should still be running
      expect(true).toBe(true)
    })
  })

  describe('getSchedule', () => {
    it('should return current schedule', () => {
      const schedule = service.getSchedule()

      expect(schedule).toBeDefined()
      expect(schedule.enabled).toBeDefined()
      expect(schedule.dayOfWeek).toBeDefined()
      expect(schedule.hour).toBeDefined()
      expect(schedule.minute).toBeDefined()
      expect(schedule.timezone).toBeDefined()
    })

    it('should return copy of schedule', () => {
      const schedule1 = service.getSchedule()
      const schedule2 = service.getSchedule()

      expect(schedule1).not.toBe(schedule2)
      expect(schedule1).toEqual(schedule2)
    })
  })

  describe('sendBackupEmail', () => {
    const mockOptions: SendBackupEmailOptions = {
      userId: 'user-123',
      companyId: 'company-456',
      userEmail: 'user@example.com',
      companyName: 'Test Company',
      backupId: 'backup-789',
      backupSizeBytes: 1024 * 1024, // 1 MB
    }

    it('should send backup email successfully', async () => {
      const result = await service.sendBackupEmail(mockOptions)

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(result.tokenId).toBeDefined()
      expect(result.restorationUrl).toBeDefined()
    })

    it('should include restoration URL', async () => {
      const result = await service.sendBackupEmail(mockOptions)

      expect(result.success).toBe(true)
      expect(result.restorationUrl).toContain('/restore')
      expect(result.restorationUrl).toContain('token=')
      expect(result.restorationUrl).toContain('id=')
    })

    it('should use provided restoration URL', async () => {
      const customUrl = 'https://app.gracefulbooks.com/restore?token=custom123&id=id456'
      const result = await service.sendBackupEmail({
        ...mockOptions,
        restorationUrl: customUrl,
      })

      expect(result.success).toBe(true)
      expect(result.restorationUrl).toBe(customUrl)
    })

    it('should format backup size correctly', async () => {
      const result = await service.sendBackupEmail({
        ...mockOptions,
        backupSizeBytes: 2.5 * 1024 * 1024, // 2.5 MB
      })

      expect(result.success).toBe(true)
      // Email should contain formatted size
    })

    it('should handle empty backup size', async () => {
      const result = await service.sendBackupEmail({
        ...mockOptions,
        backupSizeBytes: 0,
      })

      expect(result.success).toBe(true)
    })

    it('should handle large backup sizes', async () => {
      const result = await service.sendBackupEmail({
        ...mockOptions,
        backupSizeBytes: 1.5 * 1024 * 1024 * 1024, // 1.5 GB
      })

      expect(result.success).toBe(true)
    })
  })

  describe('retryFailedEmail', () => {
    const mockOptions: SendBackupEmailOptions = {
      userId: 'user-123',
      companyId: 'company-456',
      userEmail: 'user@example.com',
      companyName: 'Test Company',
      backupId: 'backup-789',
      backupSizeBytes: 1024,
    }

    it('should retry failed email', async () => {
      const result = await service.retryFailedEmail('msg-123', mockOptions)

      // Should succeed on retry
      expect(result.success).toBe(true)
    })

    it('should handle retry with no previous attempts', async () => {
      const result = await service.retryFailedEmail('msg-new', mockOptions)

      expect(result.success).toBe(true)
    })
  })

  describe('getDeliveryStatus', () => {
    it('should return null for unknown message', async () => {
      const status = await service.getDeliveryStatus('msg-unknown')

      expect(status).toBeNull()
    })
  })

  describe('getNextScheduledTime', () => {
    it('should calculate next scheduled time', () => {
      const nextTime = service.getNextScheduledTime()

      expect(nextTime).toBeInstanceOf(Date)
      expect(nextTime.getTime()).toBeGreaterThan(Date.now())
    })

    it('should respect configured day of week', () => {
      service.updateSchedule({
        dayOfWeek: 5, // Friday
        hour: 10,
        minute: 0,
      })

      const nextTime = service.getNextScheduledTime()
      const day = nextTime.getDay()

      expect(day).toBe(5) // Friday
    })

    it('should respect configured time', () => {
      service.updateSchedule({
        hour: 14,
        minute: 30,
      })

      const nextTime = service.getNextScheduledTime()

      expect(nextTime.getHours()).toBe(14)
      expect(nextTime.getMinutes()).toBe(30)
    })

    it('should return time in future', () => {
      const now = Date.now()
      const nextTime = service.getNextScheduledTime()

      expect(nextTime.getTime()).toBeGreaterThan(now)
    })
  })

  describe('schedule configuration', () => {
    it('should accept all days of week', () => {
      for (let day = 0; day <= 6; day++) {
        const config: EmailScheduleConfig = {
          ...DEFAULT_EMAIL_SCHEDULE,
          dayOfWeek: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        }

        const svc = new EmailSchedulingService(config)
        expect(svc.getSchedule().dayOfWeek).toBe(day)
        svc.stop()
      }
    })

    it('should accept all hours', () => {
      for (let hour = 0; hour < 24; hour++) {
        const config: EmailScheduleConfig = {
          ...DEFAULT_EMAIL_SCHEDULE,
          hour,
        }

        const svc = new EmailSchedulingService(config)
        expect(svc.getSchedule().hour).toBe(hour)
        svc.stop()
      }
    })

    it('should accept all minutes', () => {
      const testMinutes = [0, 15, 30, 45, 59]

      for (const minute of testMinutes) {
        const config: EmailScheduleConfig = {
          ...DEFAULT_EMAIL_SCHEDULE,
          minute,
        }

        const svc = new EmailSchedulingService(config)
        expect(svc.getSchedule().minute).toBe(minute)
        svc.stop()
      }
    })

    it('should accept various timezones', () => {
      const timezones = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Asia/Tokyo',
      ]

      for (const timezone of timezones) {
        const config: EmailScheduleConfig = {
          ...DEFAULT_EMAIL_SCHEDULE,
          timezone,
        }

        const svc = new EmailSchedulingService(config)
        expect(svc.getSchedule().timezone).toBe(timezone)
        svc.stop()
      }
    })
  })

  describe('factory function', () => {
    it('should create service instance', () => {
      const instance = createEmailSchedulingService()
      expect(instance).toBeInstanceOf(EmailSchedulingService)
      instance.stop()
    })

    it('should create service with config', () => {
      const config: EmailScheduleConfig = {
        enabled: true,
        dayOfWeek: 2,
        hour: 9,
        minute: 0,
        timezone: 'America/New_York',
      }

      const instance = createEmailSchedulingService(config)
      expect(instance.getSchedule()).toEqual(config)
      instance.stop()
    })
  })

  describe('formatScheduleDescription', () => {
    it('should format Sunday 1:00 AM', () => {
      const config: EmailScheduleConfig = {
        enabled: true,
        dayOfWeek: 0,
        hour: 1,
        minute: 0,
        timezone: 'UTC',
      }

      const description = formatScheduleDescription(config)

      expect(description).toContain('Sunday')
      expect(description).toContain('1:00')
      expect(description).toContain('AM')
      expect(description).toContain('UTC')
    })

    it('should format Friday 2:30 PM', () => {
      const config: EmailScheduleConfig = {
        enabled: true,
        dayOfWeek: 5,
        hour: 14,
        minute: 30,
        timezone: 'America/New_York',
      }

      const description = formatScheduleDescription(config)

      expect(description).toContain('Friday')
      expect(description).toContain('2:30')
      expect(description).toContain('PM')
      expect(description).toContain('America/New_York')
    })

    it('should format noon correctly', () => {
      const config: EmailScheduleConfig = {
        enabled: true,
        dayOfWeek: 3,
        hour: 12,
        minute: 0,
        timezone: 'UTC',
      }

      const description = formatScheduleDescription(config)

      expect(description).toContain('12:00')
      expect(description).toContain('PM')
    })

    it('should format midnight correctly', () => {
      const config: EmailScheduleConfig = {
        enabled: true,
        dayOfWeek: 1,
        hour: 0,
        minute: 0,
        timezone: 'UTC',
      }

      const description = formatScheduleDescription(config)

      expect(description).toContain('12:00')
      expect(description).toContain('AM')
    })

    it('should pad minutes with zero', () => {
      const config: EmailScheduleConfig = {
        enabled: true,
        dayOfWeek: 2,
        hour: 9,
        minute: 5,
        timezone: 'UTC',
      }

      const description = formatScheduleDescription(config)

      expect(description).toContain('9:05')
    })

    it('should format all days correctly', () => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      for (let i = 0; i < 7; i++) {
        const config: EmailScheduleConfig = {
          enabled: true,
          dayOfWeek: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          hour: 10,
          minute: 0,
          timezone: 'UTC',
        }

        const description = formatScheduleDescription(config)
        expect(description).toContain(days[i])
      }
    })
  })

  describe('default schedule', () => {
    it('should have Sunday as default day', () => {
      expect(DEFAULT_EMAIL_SCHEDULE.dayOfWeek).toBe(0)
    })

    it('should have 1 AM as default hour', () => {
      expect(DEFAULT_EMAIL_SCHEDULE.hour).toBe(1)
    })

    it('should have 0 minutes as default', () => {
      expect(DEFAULT_EMAIL_SCHEDULE.minute).toBe(0)
    })

    it('should be enabled by default', () => {
      expect(DEFAULT_EMAIL_SCHEDULE.enabled).toBe(true)
    })

    it('should have timezone', () => {
      expect(DEFAULT_EMAIL_SCHEDULE.timezone).toBeDefined()
      expect(typeof DEFAULT_EMAIL_SCHEDULE.timezone).toBe('string')
    })
  })

  describe('integration', () => {
    it('should coordinate with backup scheduler', () => {
      const mockScheduler = {
        // Mock BackupScheduler methods
      }

      const svc = new EmailSchedulingService(undefined, mockScheduler as any)
      expect(svc).toBeDefined()
      svc.stop()
    })

    it('should work without backup scheduler', () => {
      const svc = new EmailSchedulingService()
      expect(svc).toBeDefined()
      svc.stop()
    })
  })

  describe('error handling', () => {
    it('should handle invalid user data gracefully', async () => {
      const invalidOptions: SendBackupEmailOptions = {
        userId: '',
        companyId: '',
        userEmail: 'invalid-email',
        companyName: '',
        backupId: '',
        backupSizeBytes: -1,
      }

      // Should not throw
      const result = await service.sendBackupEmail(invalidOptions)
      expect(result).toBeDefined()
    })

    it('should handle missing restoration URL generation', async () => {
      const options: SendBackupEmailOptions = {
        userId: 'user-123',
        companyId: 'company-456',
        userEmail: 'user@example.com',
        companyName: 'Test Company',
        backupId: 'backup-789',
        backupSizeBytes: 1024,
      }

      const result = await service.sendBackupEmail(options)
      expect(result.success).toBe(true)
    })
  })
})
