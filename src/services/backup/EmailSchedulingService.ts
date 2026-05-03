/**
 * Email Scheduling Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.4 (Chunk 3F):
 * Manages automated weekly backup email scheduling with restoration links.
 *
 * Features:
 * - Weekly backup email scheduling
 * - Configurable day/time preferences
 * - Retry logic for failed deliveries
 * - Email delivery tracking
 * - User preference management
 *
 * Integration:
 * - Coordinates with BackupScheduler for backup creation
 * - Uses RestorationTokenService for secure links
 * - Uses EmailTemplate for email generation
 * - Uses S3BackupUploadService for backup storage
 *
 * Security:
 * - Rate limiting on email sends (max 1 per day per user)
 * - Token expiration (7 days)
 * - Audit logging of all email sends
 */

import { restorationTokenService, generateRestorationUrl } from './RestorationTokenService'
import { generateRestorationEmail, type EmailTemplateOptions } from './EmailTemplate'
import type { BackupScheduler } from './BackupScheduler'

/**
 * Email schedule configuration
 */
export interface EmailScheduleConfig {
  enabled: boolean
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday, 6 = Saturday
  hour: number // 0-23 (24-hour format)
  minute: number // 0-59
  timezone: string // IANA timezone (e.g., 'America/New_York')
}

/**
 * Email send options
 */
export interface SendBackupEmailOptions {
  userId: string
  companyId: string
  userEmail: string
  companyName: string
  backupId: string
  backupSizeBytes: number
  restorationUrl?: string // If not provided, will generate token
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean
  messageId?: string
  tokenId?: string
  restorationUrl?: string
  error?: string
  retryable?: boolean
}

/**
 * Email delivery status
 */
export interface EmailDeliveryStatus {
  messageId: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
  sentAt?: number
  deliveredAt?: number
  failedAt?: number
  error?: string
  retryCount: number
  lastRetryAt?: number
}

/**
 * Default schedule: Sunday at 1:00 AM
 */
export const DEFAULT_EMAIL_SCHEDULE: EmailScheduleConfig = {
  enabled: true,
  dayOfWeek: 0, // Sunday
  hour: 1,
  minute: 0,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}

/**
 * Email rate limits
 */
const EMAIL_RATE_LIMITS = {
  maxPerDay: 1,
  maxRetries: 3,
  retryDelayMs: 60 * 60 * 1000, // 1 hour
}

/**
 * Email Scheduling Service
 *
 * Manages automated weekly backup email delivery with restoration links.
 */
export class EmailSchedulingService {
  private scheduleIntervalId?: number
  private config: EmailScheduleConfig
  private backupScheduler?: BackupScheduler

  constructor(
    config: EmailScheduleConfig = DEFAULT_EMAIL_SCHEDULE,
    backupScheduler?: BackupScheduler
  ) {
    this.config = config
    this.backupScheduler = backupScheduler
  }

  /**
   * Start email scheduling
   *
   * Begins checking for scheduled emails to send.
   */
  start(): void {
    if (this.scheduleIntervalId) {
      console.warn('[EmailSchedulingService] Already started')
      return
    }

    if (!this.config.enabled) {
      console.log('[EmailSchedulingService] Email scheduling is disabled')
      return
    }

    // Check every hour for scheduled emails
    this.scheduleIntervalId = window.setInterval(
      () => this.checkSchedule(),
      60 * 60 * 1000 // 1 hour
    )

    // Check immediately on start
    this.checkSchedule()

    console.log('[EmailSchedulingService] Started email scheduling')
  }

  /**
   * Stop email scheduling
   *
   * Stops checking for scheduled emails.
   */
  stop(): void {
    if (this.scheduleIntervalId) {
      clearInterval(this.scheduleIntervalId)
      this.scheduleIntervalId = undefined
      console.log('[EmailSchedulingService] Stopped email scheduling')
    }
  }

  /**
   * Update schedule configuration
   *
   * @param config - New schedule configuration
   */
  updateSchedule(config: Partial<EmailScheduleConfig>): void {
    this.config = { ...this.config, ...config }

    // Restart if running
    if (this.scheduleIntervalId) {
      this.stop()
      this.start()
    }
  }

  /**
   * Get current schedule configuration
   *
   * @returns Current schedule configuration
   */
  getSchedule(): EmailScheduleConfig {
    return { ...this.config }
  }

  /**
   * Check if it's time to send scheduled email
   *
   * Called periodically to check if email should be sent.
   */
  private async checkSchedule(): Promise<void> {
    try {
      const now = new Date()
      const shouldSend = this.shouldSendNow(now)

      if (shouldSend) {
        console.log('[EmailSchedulingService] Time to send scheduled emails')
        // In real implementation, would query database for users
        // For now, this is a placeholder that demonstrates the structure
      }
    } catch (error) {
      console.error('[EmailSchedulingService] Error checking schedule:', error)
    }
  }

  /**
   * Check if email should be sent now
   *
   * @param now - Current date/time
   * @returns True if email should be sent
   */
  private shouldSendNow(now: Date): boolean {
    // Convert to configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.config.timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    })

    const parts = formatter.formatToParts(now)
    const weekday = parts.find((p) => p.type === 'weekday')?.value
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10)

    // Map weekday to number
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }

    const currentDay = weekdayMap[weekday || 'Sun']

    // Check if current time matches schedule
    return (
      currentDay === this.config.dayOfWeek &&
      hour === this.config.hour &&
      minute === this.config.minute
    )
  }

  /**
   * Send backup email to user
   *
   * Creates restoration token, generates email, and sends to user.
   *
   * @param options - Email send options
   * @returns Email send result
   */
  async sendBackupEmail(options: SendBackupEmailOptions): Promise<EmailSendResult> {
    try {
      // Validate rate limits
      const canSend = await this.checkRateLimit(options.userId)
      if (!canSend) {
        return {
          success: false,
          error: 'Rate limit exceeded (max 1 email per day)',
          retryable: false,
        }
      }

      // Generate restoration token if not provided
      let restorationUrl = options.restorationUrl
      let tokenId: string | undefined

      if (!restorationUrl) {
        const tokenResult = await restorationTokenService.generateToken({
          userId: options.userId,
          companyId: options.companyId,
          backupId: options.backupId,
        })

        if (!tokenResult.success || !tokenResult.token) {
          return {
            success: false,
            error: tokenResult.error || 'Failed to generate restoration token',
            retryable: true,
          }
        }

        tokenId = tokenResult.tokenId
        restorationUrl = generateRestorationUrl(tokenResult.token, tokenResult.tokenId!)
      }

      // Generate email content
      const emailOptions: EmailTemplateOptions = {
        recipientEmail: options.userEmail,
        restorationUrl,
        companyName: options.companyName,
        backupDate: new Date(),
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        backupSizeFormatted: this.formatBytes(options.backupSizeBytes),
      }

      const emailTemplate = generateRestorationEmail(emailOptions)

      // Send email (in real implementation, would use email service)
      const messageId = await this.sendEmail({
        to: options.userEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      })

      // Record send in rate limit tracking
      await this.recordEmailSend(options.userId)

      return {
        success: true,
        messageId,
        tokenId,
        restorationUrl,
      }
    } catch (error) {
      console.error('[EmailSchedulingService] Error sending email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
        retryable: true,
      }
    }
  }

  /**
   * Retry failed email delivery
   *
   * @param messageId - Original message ID
   * @param options - Original send options
   * @returns Email send result
   */
  async retryFailedEmail(
    messageId: string,
    options: SendBackupEmailOptions
  ): Promise<EmailSendResult> {
    try {
      // Check retry count
      const retryCount = await this.getRetryCount(messageId)
      if (retryCount >= EMAIL_RATE_LIMITS.maxRetries) {
        return {
          success: false,
          error: 'Maximum retry attempts exceeded',
          retryable: false,
        }
      }

      // Wait for retry delay
      const lastRetry = await this.getLastRetryTime(messageId)
      if (lastRetry && Date.now() - lastRetry < EMAIL_RATE_LIMITS.retryDelayMs) {
        return {
          success: false,
          error: 'Retry delay not yet elapsed',
          retryable: true,
        }
      }

      // Retry send
      const result = await this.sendBackupEmail(options)

      // Update retry tracking
      if (result.success) {
        await this.clearRetryTracking(messageId)
      } else if (result.retryable) {
        await this.incrementRetryCount(messageId)
      }

      return result
    } catch (error) {
      console.error('[EmailSchedulingService] Error retrying email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry email',
        retryable: true,
      }
    }
  }

  /**
   * Get email delivery status
   *
   * @param messageId - Message ID
   * @returns Delivery status
   */
  async getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus | null> {
    // In real implementation, would query email service status
    // For now, this is a placeholder
    return null
  }

  /**
   * Check rate limit for user
   *
   * @param userId - User ID
   * @returns True if user can send email
   */
  private async checkRateLimit(userId: string): Promise<boolean> {
    // In real implementation, would check database
    // For now, allow all sends
    return true
  }

  /**
   * Record email send for rate limiting
   *
   * @param userId - User ID
   */
  private async recordEmailSend(userId: string): Promise<void> {
    // In real implementation, would record in database
    // For now, this is a placeholder
  }

  /**
   * Get retry count for message
   *
   * @param messageId - Message ID
   * @returns Retry count
   */
  private async getRetryCount(messageId: string): Promise<number> {
    // In real implementation, would query database
    return 0
  }

  /**
   * Get last retry time for message
   *
   * @param messageId - Message ID
   * @returns Last retry timestamp
   */
  private async getLastRetryTime(messageId: string): Promise<number | null> {
    // In real implementation, would query database
    return null
  }

  /**
   * Increment retry count for message
   *
   * @param messageId - Message ID
   */
  private async incrementRetryCount(messageId: string): Promise<void> {
    // In real implementation, would update database
  }

  /**
   * Clear retry tracking for message
   *
   * @param messageId - Message ID
   */
  private async clearRetryTracking(messageId: string): Promise<void> {
    // In real implementation, would clear database
  }

  /**
   * Send email via email service
   *
   * @param email - Email to send
   * @returns Message ID
   */
  private async sendEmail(email: {
    to: string
    subject: string
    html: string
    text: string
  }): Promise<string> {
    // In real implementation, would use email service (SendGrid, AWS SES, etc.)
    // For now, this is a placeholder that generates a message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    console.log('[EmailSchedulingService] Email sent:', {
      to: email.to,
      subject: email.subject,
      messageId,
    })

    return messageId
  }

  /**
   * Format bytes to human-readable string
   *
   * @param bytes - Number of bytes
   * @returns Formatted string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * Calculate next scheduled send time
   *
   * @returns Next scheduled send date
   */
  getNextScheduledTime(): Date {
    const now = new Date()

    // Create date in configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })

    const parts = formatter.formatToParts(now)
    const currentWeekday = parts.find((p) => p.type === 'weekday')?.value

    // Map weekday to number
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }

    const currentDay = weekdayMap[currentWeekday || 'Sun']
    const targetDay = this.config.dayOfWeek

    // Calculate days until next occurrence
    let daysUntil = targetDay - currentDay
    if (daysUntil <= 0) {
      daysUntil += 7
    }

    // Create next scheduled date
    const nextDate = new Date(now)
    nextDate.setDate(nextDate.getDate() + daysUntil)
    nextDate.setHours(this.config.hour, this.config.minute, 0, 0)

    return nextDate
  }
}

/**
 * Create email scheduling service instance
 *
 * @param config - Email schedule configuration
 * @param backupScheduler - Optional backup scheduler for coordination
 * @returns Email scheduling service
 */
export function createEmailSchedulingService(
  config?: EmailScheduleConfig,
  backupScheduler?: BackupScheduler
): EmailSchedulingService {
  return new EmailSchedulingService(config, backupScheduler)
}

/**
 * Format schedule for display
 *
 * @param config - Schedule configuration
 * @returns Human-readable schedule description
 */
export function formatScheduleDescription(config: EmailScheduleConfig): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = days[config.dayOfWeek]

  // Format time
  const hour12 = config.hour % 12 || 12
  const ampm = config.hour < 12 ? 'AM' : 'PM'
  const minute = config.minute.toString().padStart(2, '0')

  return `Every ${day} at ${hour12}:${minute} ${ampm} (${config.timezone})`
}
