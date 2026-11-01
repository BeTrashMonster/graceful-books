/**
 * Schedule Trial Ending Emails for Built Fall Cohort 2026
 *
 * This script:
 * 1. Updates the workshop's trial ending email template with custom PS message
 * 2. Schedules the trialEnding email for all existing enrollees who haven't received it
 *
 * Usage: npx tsx scripts/schedule-trial-ending-emails.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const COHORT_NAME = 'Built-fall-cohort-2026';

// Custom trial ending email template with the PS message
const CUSTOM_TRIAL_ENDING_TEMPLATE = {
  subject: '[AM] Your trial is ending soon',
  preheader: 'Action needed to continue using the Product Costing Tool',
  htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #4b006e;">Your Trial Ends Soon</h1>

  <p>Hey {{firstName}},</p>

  <p>A friendly heads up: your free trial of the <strong>Product Costing Tool</strong> from the <strong>{{workshopName}}</strong> workshop is ending soon.</p>

  <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
    <p style="margin: 0;"><strong>Trial ends:</strong> {{trialEndDate}}</p>
    <p style="margin: 10px 0 0 0; font-size: 14px; color: #92400e;">To keep using the Product Costing Tool after your trial, you'll need to set up your subscription.</p>
  </div>

  <h3 style="color: #4b006e;">Want to Continue?</h3>
  <p>To keep access after {{trialEndDate}}, just sign in to your account and:</p>
  <ol style="line-height: 1.8;">
    <li>Go to <strong>Billing → Payment Method</strong></li>
    <li>Add your payment information</li>
    <li>Go to <strong>Settings → Charity Selection</strong></li>
    <li>Choose a charity for us to contribute $5/month to on your behalf</li>
  </ol>
  <p>Then to keep your data safe, scroll up to Data Safety and set a location for your data to live on your computer.</p>

  <p style="margin: 20px 0;">
    <a href="https://app.audacious.money/login" style="background: #4b006e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Log In To Your Account</a>
  </p>

  <h3 style="color: #4b006e;">Not Ready to Continue?</h3>
  <p>No worries at all! Your trial will simply end on {{trialEndDate}} and your account will remain available if you decide to subscribe later. No action needed from you - there's no automatic charge.</p>

  <p><strong>Have questions?</strong> Reply to this email and we'll help you figure out what's best for you.</p>

  <p>— Audrey & The Audacious Money Team</p>

  <p style="margin-top: 30px;"><strong>PS – Want everything set up for you?</strong> So that you can have your numbers and your data at your fingertips.</p>
  <p>Because you are a part of Built Oregon's Accelerator Program I am happy to extend a one time setup of $450.</p>
  <p>Reply and let me know if you want to schedule a chat to see if it's for you or schedule our first session (I am also happy to work with budgets so don't be shy!).</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔍 Finding workshop:', COHORT_NAME);

    // Find the workshop
    const workshopResult = await pool.query(
      `SELECT id, cohort_name, workshop_name, custom_email_templates, custom_email_schedule
       FROM workshops
       WHERE cohort_name = $1`,
      [COHORT_NAME]
    );

    if (workshopResult.rowCount === 0) {
      console.error('❌ Workshop not found:', COHORT_NAME);
      process.exit(1);
    }

    const workshop = workshopResult.rows[0];
    console.log('✅ Found workshop:', workshop.id, workshop.cohort_name);

    // Update the workshop's custom email template
    const existingTemplates = workshop.custom_email_templates || {};
    const updatedTemplates = {
      ...existingTemplates,
      trialEnding: CUSTOM_TRIAL_ENDING_TEMPLATE,
    };

    // Also ensure trialEnding is enabled in the schedule
    const existingSchedule = workshop.custom_email_schedule || {};
    const updatedSchedule = {
      ...existingSchedule,
      trialEnding: { enabled: true, when: { days_before_trial_expires: 3 } },
    };

    await pool.query(
      `UPDATE workshops
       SET custom_email_templates = $1, custom_email_schedule = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(updatedTemplates), JSON.stringify(updatedSchedule), workshop.id]
    );
    console.log('✅ Updated workshop email template with custom PS message');

    // Find all enrollments that need the trial ending email scheduled
    // Excludes users who:
    // - Already have a trialEnding email scheduled or sent
    // - Have an active subscription (converted_to_paid_at is set OR user_products has active status)
    const enrollmentsResult = await pool.query(
      `SELECT we.id, we.user_id, we.trial_expires_at, u.email, u.first_name
       FROM workshop_enrollments we
       JOIN users u ON we.user_id = u.id
       WHERE we.workshop_id = $1
         AND we.trial_expires_at IS NOT NULL
         AND we.trial_expires_at > NOW()
         AND we.status = 'active'
         AND we.converted_to_paid_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM user_products up
           WHERE up.user_id = we.user_id
             AND up.status = 'active'
         )
         AND NOT EXISTS (
           SELECT 1 FROM scheduled_emails se
           WHERE se.enrollment_id = we.id
             AND se.email_type = 'trialEnding'
             AND se.status IN ('pending', 'sent')
         )`,
      [workshop.id]
    );

    console.log(`📧 Found ${enrollmentsResult.rowCount} enrollments needing trialEnding email`);

    let scheduled = 0;
    let skipped = 0;

    for (const enrollment of enrollmentsResult.rows) {
      const trialExpiresAt = new Date(enrollment.trial_expires_at);
      const daysBefore = 3;
      const sendTime = new Date(trialExpiresAt);
      sendTime.setDate(sendTime.getDate() - daysBefore);

      // Only schedule if send time is in the future
      if (sendTime > new Date()) {
        await pool.query(
          `INSERT INTO scheduled_emails
           (enrollment_id, workshop_id, user_id, email_type, recipient_email, scheduled_for, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           ON CONFLICT DO NOTHING`,
          [
            enrollment.id,
            workshop.id,
            enrollment.user_id,
            'trialEnding',
            enrollment.email,
            sendTime.toISOString(),
          ]
        );
        console.log(`  ✅ Scheduled for ${enrollment.email} - send at ${sendTime.toISOString()}`);
        scheduled++;
      } else {
        console.log(`  ⏭️ Skipped ${enrollment.email} - send time already passed (${sendTime.toISOString()})`);
        skipped++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  Scheduled: ${scheduled}`);
    console.log(`  Skipped (time passed): ${skipped}`);
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
