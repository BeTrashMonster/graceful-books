/**
 * Backup Test Notification Service
 *
 * Sends email notifications to admins about automated backup test results.
 * Critical alerts when backups fail testing - you need to know immediately!
 */

import { db } from '../../store/database'
import type { UserEntityEntity, AuditLogEntity } from '../../store/types'

/**
 * Backup test notification data
 */
export interface BackupTestNotificationData {
  /** Company ID */
  companyId: string

  /** Company name */
  companyName: string

  /** Test ID */
  testId: string

  /** Whether test passed */
  success: boolean

  /** When test was performed */
  testedAt: Date

  /** Test duration in milliseconds */
  durationMs: number

  /** Number of records tested */
  recordsTested: number

  /** Error messages (if failed) */
  errors: string[]

  /** Test phase when failure occurred */
  phase?: string
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean
  notifiedCount: number
  notifiedEmails: string[]
  error?: string
}

/**
 * Get admin users for a company
 */
async function getCompanyAdmins(companyId: string): Promise<UserEntity[]> {
  try {
    const users = await db.users
      .where('companyId')
      .equals(companyId)
      .toArray()

    return users.filter((user: UserEntity) => user.role === 'admin' && user.email)
  } catch (error) {
    console.error('Failed to get company admins:', error)
    return []
  }
}

/**
 * Send email via Postmark (uses same backend API as AdminNotificationService)
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

    const response = await fetch(`${apiUrl}/api/admin/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        htmlBody: body,
      }),
    })

    if (!response.ok) {
      return false
    }

    const result = await response.json()
    return result.success === true
  } catch (error) {
    console.error('Failed to send email via Postmark:', error)

    // DEV MODE: Log email for testing
    if (import.meta.env.DEV) {
      console.log('📧 Backup Test Notification (DEV MODE):')
      console.log(`To: ${to}`)
      console.log(`Subject: ${subject}`)
      console.log(`Body:\n${body}`)
      return true
    }

    return false
  }
}

/**
 * Notify admins of backup test result
 *
 * Sends email notification to all company admins about backup test outcome.
 * ALWAYS notifies on failure, optionally notifies on success.
 *
 * @param data - Test notification data
 * @returns Notification result
 */
export async function notifyBackupTestResult(
  data: BackupTestNotificationData
): Promise<NotificationResult> {
  try {
    const admins = await getCompanyAdmins(data.companyId)

    if (admins.length === 0) {
      return {
        success: false,
        notifiedCount: 0,
        notifiedEmails: [],
        error: 'No admin users found for company',
      }
    }

    const notifiedEmails: string[] = []

    // Email subject
    const subject = data.success
      ? `✅ Backup Test Passed - ${data.companyName}`
      : `🚨 CRITICAL: Backup Test Failed - ${data.companyName}`

    // Email body
    const body = data.success
      ? buildSuccessEmail(data)
      : buildFailureEmail(data)

    // Send to all admins
    for (const admin of admins) {
      const sent = await sendEmail(admin.email, subject, body)
      if (sent) {
        notifiedEmails.push(admin.email)
      }
    }

    // Record notification in audit log
    const auditEntry: AuditLogEntity = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      companyId: data.companyId,
      timestamp: new Date(),
      userId: 'SYSTEM',
      deviceId: 'system',
      entityType: 'backup',
      entityId: data.testId,
      action: data.success
        ? 'ADMIN_NOTIFIED_BACKUP_TEST_SUCCESS'
        : 'ADMIN_NOTIFIED_BACKUP_TEST_FAILURE',
      changedFields: [],
      beforeValues: JSON.stringify({}),
      afterValues: JSON.stringify({
        testId: data.testId,
        success: data.success,
        notifiedEmails,
        recordsTested: data.recordsTested,
        durationMs: data.durationMs,
      }),
      _encrypted: {
        beforeValues: false,
        afterValues: false,
      },
    }

    await db.auditLogs.add(auditEntry)

    return {
      success: true,
      notifiedCount: notifiedEmails.length,
      notifiedEmails,
    }
  } catch (error) {
    console.error('Failed to notify admins of backup test result:', error)
    return {
      success: false,
      notifiedCount: 0,
      notifiedEmails: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Build success email HTML
 */
function buildSuccessEmail(data: BackupTestNotificationData): string {
  const durationSeconds = (data.durationMs / 1000).toFixed(1)

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #059669;">✅ Backup Test Passed</h2>

          <p>This is an automated notification from Audacious Money.</p>

          <div style="background: #d1fae5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
            <p><strong>Your weekly backup test completed successfully.</strong></p>
          </div>

          <h3>Test Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Company:</strong></td>
              <td style="padding: 8px 0;">${data.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Test ID:</strong></td>
              <td style="padding: 8px 0; font-family: monospace;">${data.testId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Tested:</strong></td>
              <td style="padding: 8px 0;">${data.testedAt.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Duration:</strong></td>
              <td style="padding: 8px 0;">${durationSeconds}s</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Records Tested:</strong></td>
              <td style="padding: 8px 0;">${data.recordsTested.toLocaleString()}</td>
            </tr>
          </table>

          <h3>What Was Tested:</h3>
          <ol>
            <li><strong>Backup Creation:</strong> Successfully created test backup</li>
            <li><strong>Restoration:</strong> Successfully restored all data</li>
            <li><strong>Validation:</strong> Verified data integrity (sample-based)</li>
            <li><strong>Cleanup:</strong> Removed test artifacts</li>
          </ol>

          <div style="background: #f0fdf4; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0;"><strong>✓ Your backups are working correctly.</strong> In an emergency, you can restore your data with confidence.</p>
          </div>

          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 0.9em; color: #666;">
            This is an automated notification from Audacious Money. Backup tests run weekly to ensure data safety.
          </p>
        </div>
      </body>
    </html>
  `
}

/**
 * Build failure email HTML
 */
function buildFailureEmail(data: BackupTestNotificationData): string {
  const durationSeconds = (data.durationMs / 1000).toFixed(1)

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">🚨 CRITICAL: Backup Test Failed</h2>

          <p>This is an automated notification from Audacious Money.</p>

          <div style="background: #fee2e2; border: 3px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #dc2626;">Your Backup System Needs Immediate Attention</h3>
            <p style="margin-bottom: 0;"><strong>The automated backup test has failed. Your backups may not be restorable in an emergency.</strong></p>
          </div>

          <h3>Test Details:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Company:</strong></td>
              <td style="padding: 8px 0;">${data.companyName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Test ID:</strong></td>
              <td style="padding: 8px 0; font-family: monospace;">${data.testId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Tested:</strong></td>
              <td style="padding: 8px 0;">${data.testedAt.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Duration:</strong></td>
              <td style="padding: 8px 0;">${durationSeconds}s</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Failed Phase:</strong></td>
              <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${data.phase || 'Unknown'}</td>
            </tr>
          </table>

          <h3>Errors:</h3>
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; font-family: monospace; font-size: 0.9em;">
            ${data.errors.map((error) => `<div style="margin: 5px 0;">• ${error}</div>`).join('')}
          </div>

          <h3>IMMEDIATE ACTIONS REQUIRED:</h3>
          <ol style="color: #dc2626; font-weight: bold;">
            <li>Investigate the error messages above</li>
            <li>Check backup storage availability and permissions</li>
            <li>Verify database connectivity</li>
            <li>Review system logs for additional details</li>
            <li>Test manual backup creation to isolate the issue</li>
            <li>Fix the underlying problem</li>
            <li>Run another backup test to verify the fix</li>
          </ol>

          <div style="background: #fef3c7; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0;"><strong>⚠️ Critical Reminder:</strong> Backups are your last line of defense against data loss. A failed backup test means you may not be able to recover data in an emergency. This issue should be treated as a P0 incident.</p>
          </div>

          <h3>What Happens Next:</h3>
          <ul>
            <li>Another backup test will run in 7 days</li>
            <li>You'll receive another alert if the issue persists</li>
            <li>Consider investigating immediately to avoid data loss risk</li>
          </ul>

          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 0.9em; color: #666;">
            This is an automated critical notification from Audacious Money. Do not ignore this alert.
          </p>
        </div>
      </body>
    </html>
  `
}
