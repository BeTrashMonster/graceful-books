/**
 * Cron Job Endpoints
 *
 * Endpoints called by external cron services to perform scheduled tasks.
 * Protected by secret key authentication.
 *
 * SECURITY: These endpoints must verify the CRON_SECRET to prevent unauthorized access.
 */

import { Hono } from 'hono';
import { getDatabase } from '../db/connection.js';
import { processScheduledEmails } from '../services/emailScheduler.service.js';

const cron = new Hono();

// =============================================================================
// MIDDLEWARE: Verify Cron Secret
// =============================================================================

/**
 * Verify the cron secret key before processing.
 * The secret should be passed as either:
 * - Authorization: Bearer <secret>
 * - X-Cron-Secret: <secret>
 * - ?secret=<secret> (query param)
 */
function verifyCronSecret(c: any): boolean {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    console.error('[Cron] CRON_SECRET not configured');
    return false;
  }

  // Check Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === configuredSecret) return true;
  }

  // Check X-Cron-Secret header
  const cronHeader = c.req.header('X-Cron-Secret');
  if (cronHeader === configuredSecret) return true;

  // Check query param (less secure, but useful for simple cron services)
  const querySecret = c.req.query('secret');
  if (querySecret === configuredSecret) return true;

  return false;
}

// =============================================================================
// EMAIL WORKER ENDPOINT
// =============================================================================

/**
 * POST /api/cron/process-emails
 *
 * Process scheduled emails that are ready to send.
 * Should be called every 5 minutes by an external cron service.
 *
 * Example cron setup (using cron-job.org or similar):
 * - URL: https://your-api.com/api/cron/process-emails
 * - Method: POST
 * - Header: X-Cron-Secret: your-secret-key
 * - Schedule: Every 5 minutes
 */
cron.post('/process-emails', async (c) => {
  // Verify secret
  if (!verifyCronSecret(c)) {
    console.warn('[Cron] Unauthorized attempt to access /process-emails');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const startTime = Date.now();
  console.log('[Cron] Starting email processing...');

  try {
    const db = getDatabase();
    const result = await processScheduledEmails(db);

    const duration = Date.now() - startTime;
    console.log(`[Cron] Email processing completed in ${duration}ms`);

    return c.json({
      success: true,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      durationMs: duration,
    });

  } catch (error: any) {
    console.error('[Cron] Error processing emails:', error);
    return c.json({
      success: false,
      error: error.message || 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/cron/health
 *
 * Health check endpoint for monitoring.
 * Returns basic status without requiring authentication.
 */
cron.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    service: 'email-scheduler',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/cron/status
 *
 * Get current queue status (requires authentication).
 * Returns counts of pending, processing, and failed emails.
 */
cron.get('/status', async (c) => {
  // Verify secret
  if (!verifyCronSecret(c)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const db = getDatabase();

    const result = await db.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM scheduled_emails
      GROUP BY status
    `);

    const statusCounts: Record<string, number> = {};
    for (const row of result.rows) {
      statusCounts[row.status] = parseInt(row.count);
    }

    // Get count of emails ready to send
    const readyResult = await db.query(`
      SELECT COUNT(*) as count
      FROM scheduled_emails
      WHERE status = 'pending'
        AND scheduled_for <= NOW()
        AND attempts < max_attempts
    `);

    return c.json({
      success: true,
      statusCounts,
      readyToSend: parseInt(readyResult.rows[0].count),
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[Cron] Error getting status:', error);
    return c.json({
      success: false,
      error: error.message || 'Unknown error',
    }, 500);
  }
});

export default cron;
