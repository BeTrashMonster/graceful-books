/**
 * Test Email Route
 *
 * Temporary route for testing Postmark email integration.
 * DELETE THIS FILE after confirming emails work!
 */

import { Hono } from 'hono';
import { sendTestEmail, sendWelcomeEmail } from '../services/email.service';

const app = new Hono();

/**
 * GET /test/email
 *
 * Sends a basic test email to verify Postmark is configured correctly.
 *
 * Usage:
 *   curl http://localhost:3001/test/email?to=your-email@example.com
 *
 * Or in browser:
 *   http://localhost:3001/test/email?to=your-email@example.com
 */
app.get('/email', async (c) => {
  try {
    // Get email from query parameter, default to a test address
    const toEmail = c.req.query('to') || 'audrey@thegracefulpenny.com';

    console.log(`[TEST] Sending test email to: ${toEmail}`);

    // Send test email
    await sendTestEmail(toEmail);

    console.log(`[TEST] Email sent successfully!`);

    return c.json({
      success: true,
      message: 'Test email sent successfully!',
      to: toEmail,
      from: process.env.POSTMARK_FROM_EMAIL,
      note: 'Check your inbox! Email should arrive within seconds.'
    });

  } catch (error) {
    console.error('[TEST] Email send failed:', error);

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Check your POSTMARK_SERVER_TOKEN in .env file'
    }, 500);
  }
});

/**
 * GET /test/email/welcome
 *
 * Sends a welcome email (the actual template users will receive).
 *
 * Usage:
 *   curl http://localhost:3001/test/email/welcome?to=your-email@example.com
 */
app.get('/email/welcome', async (c) => {
  try {
    const toEmail = c.req.query('to') || 'audrey@thegracefulpenny.com';

    console.log(`[TEST] Sending welcome email to: ${toEmail}`);

    await sendWelcomeEmail(
      toEmail,
      'Test User',
      'AM-TEST-1234-5678'
    );

    console.log(`[TEST] Welcome email sent successfully!`);

    return c.json({
      success: true,
      message: 'Welcome email sent successfully!',
      to: toEmail,
      template: 'Welcome Email (full production template)'
    });

  } catch (error) {
    console.error('[TEST] Welcome email failed:', error);

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
