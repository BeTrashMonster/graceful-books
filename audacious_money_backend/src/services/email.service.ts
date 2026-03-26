/**
 * Email Service - Postmark Integration
 *
 * Handles all transactional emails for Audacious Money
 * using Postmark's reliable email delivery.
 */

import * as postmark from 'postmark';

// Initialize Postmark client
const client = new postmark.ServerClient(
  process.env.POSTMARK_SERVER_TOKEN || ''
);

const FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'noreply@audacious.money';
const FROM_NAME = process.env.POSTMARK_FROM_NAME || 'Audacious Money';

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  supportKey: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Welcome to Audacious Money! 🌟',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to Audacious Money!</h1>
        <p>Hi there,</p>
        <p>We're thrilled to have you join us. You're taking an important step toward financial clarity and confidence.</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Account Details</h3>
          <p><strong>Email:</strong> ${to}</p>
          <p><strong>Support Key:</strong> ${supportKey}</p>
          <p style="font-size: 14px; color: #6b7280;">Keep your Support Key safe - you'll need it if you ever contact our support team.</p>
        </div>

        <h3>What's Next?</h3>
        <ol>
          <li>Complete your onboarding assessment</li>
          <li>Select your charity to support</li>
          <li>Start exploring your financial tools</li>
        </ol>

        <p>If you have any questions, just reply to this email. We're here to help!</p>

        <p>Take your time with this. We'll walk through everything together.</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Welcome to Audacious Money!

Hi there,

We're thrilled to have you join us. You're taking an important step toward financial clarity and confidence.

Your Account Details:
- Email: ${to}
- Support Key: ${supportKey}

Keep your Support Key safe - you'll need it if you ever contact our support team.

What's Next?
1. Complete your onboarding assessment
2. Select your charity to support
3. Start exploring your financial tools

If you have any questions, just reply to this email. We're here to help!

Take your time with this. We'll walk through everything together.

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send trial started email
 */
export async function sendTrialStartedEmail(
  to: string,
  productName: string,
  trialEndDate: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `Your ${productName} trial has started!`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Your Trial Has Started!</h1>
        <p>Great news! Your 30-day trial of <strong>${productName}</strong> is now active.</p>

        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 0;"><strong>Trial ends:</strong> ${trialEndDate}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #065f46;">No charges until your trial ends. Cancel anytime.</p>
        </div>

        <h3>Make the Most of Your Trial</h3>
        <ul>
          <li>Explore all features without limits</li>
          <li>Set up your financial workflows</li>
          <li>Connect your accounts</li>
          <li>Get familiar with reporting</li>
        </ul>

        <p>We'll send you a reminder 7 days before your trial ends, so you have plenty of time to decide.</p>

        <p>Have questions? Just reply to this email.</p>

        <p>— The Audacious Money Team</p>
      </div>
    `,
    TextBody: `Your Trial Has Started!

Great news! Your 30-day trial of ${productName} is now active.

Trial ends: ${trialEndDate}
No charges until your trial ends. Cancel anytime.

Make the Most of Your Trial:
- Explore all features without limits
- Set up your financial workflows
- Connect your accounts
- Get familiar with reporting

We'll send you a reminder 7 days before your trial ends, so you have plenty of time to decide.

Have questions? Just reply to this email.

— The Audacious Money Team`,
    MessageStream: 'outbound'
  });
}

/**
 * Send trial ending soon reminder (7 days before)
 */
export async function sendTrialEndingSoonEmail(
  to: string,
  productName: string,
  trialEndDate: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `Your ${productName} trial ends in 7 days`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Your Trial Ends Soon</h1>
        <p>Just a friendly heads up: your 30-day trial of <strong>${productName}</strong> ends in 7 days.</p>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0;"><strong>Trial ends:</strong> ${trialEndDate}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #92400e;">Your subscription will start automatically unless you cancel.</p>
        </div>

        <h3>Your Options</h3>
        <p><strong>Want to continue?</strong> You don't need to do anything. Your subscription will start automatically on ${trialEndDate}.</p>
        <p><strong>Want to cancel?</strong> No problem! Just go to Settings → Subscriptions and click "Cancel Trial".</p>
        <p><strong>Have questions?</strong> Reply to this email and we'll help you decide what's best for you.</p>

        <p>No pressure. We're here to support whatever decision works for you.</p>

        <p>— The Audacious Money Team</p>
      </div>
    `,
    TextBody: `Your Trial Ends Soon

Just a friendly heads up: your 30-day trial of ${productName} ends in 7 days.

Trial ends: ${trialEndDate}
Your subscription will start automatically unless you cancel.

Your Options:
- Want to continue? You don't need to do anything. Your subscription will start automatically on ${trialEndDate}.
- Want to cancel? No problem! Just go to Settings → Subscriptions and click "Cancel Trial".
- Have questions? Reply to this email and we'll help you decide what's best for you.

No pressure. We're here to support whatever decision works for you.

— The Audacious Money Team`,
    MessageStream: 'outbound'
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  appUrl: string
): Promise<void> {
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Reset your Audacious Money password',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Reset Your Password</h1>
        <p>We received a request to reset your password for your Audacious Money account.</p>

        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Reset Your Password
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 14px; color: #2563eb; word-break: break-all;">${resetUrl}</p>

        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Important:</strong> This link expires in 1 hour for security.</p>
        </div>

        <p><strong>Didn't request this?</strong> You can safely ignore this email. Your password won't be changed.</p>

        <p>— The Audacious Money Team</p>
      </div>
    `,
    TextBody: `Reset Your Password

We received a request to reset your password for your Audacious Money account.

Click this link to reset your password:
${resetUrl}

Important: This link expires in 1 hour for security.

Didn't request this? You can safely ignore this email. Your password won't be changed.

— The Audacious Money Team`,
    MessageStream: 'outbound'
  });
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(
  to: string,
  productName: string,
  amount: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Payment issue with your subscription',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Payment Issue</h1>
        <p>We had trouble processing your payment for <strong>${productName}</strong>.</p>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 0;"><strong>Amount:</strong> ${amount}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #991b1b;">Your subscription will be paused until payment is successful.</p>
        </div>

        <h3>What to Do</h3>
        <ol>
          <li>Log into your account</li>
          <li>Go to Settings → Billing</li>
          <li>Update your payment method</li>
          <li>We'll retry the payment automatically</li>
        </ol>

        <p>Need help? Reply to this email and we'll sort this out together.</p>

        <p>— The Audacious Money Team</p>
      </div>
    `,
    TextBody: `Payment Issue

We had trouble processing your payment for ${productName}.

Amount: ${amount}
Your subscription will be paused until payment is successful.

What to Do:
1. Log into your account
2. Go to Settings → Billing
3. Update your payment method
4. We'll retry the payment automatically

Need help? Reply to this email and we'll sort this out together.

— The Audacious Money Team`,
    MessageStream: 'outbound'
  });
}

/**
 * Send subscription cancelled email
 */
export async function sendSubscriptionCancelledEmail(
  to: string,
  productName: string,
  endDate: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `Your ${productName} subscription has been cancelled`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Subscription Cancelled</h1>
        <p>We've cancelled your subscription to <strong>${productName}</strong> as requested.</p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Access until:</strong> ${endDate}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">You can continue using ${productName} until ${endDate}. After that, your data will be preserved but access will be paused.</p>
        </div>

        <h3>Changed Your Mind?</h3>
        <p>You can reactivate your subscription anytime by logging into your account and going to Settings → Subscriptions.</p>

        <p>We're sorry to see you go, but we'd love to hear your feedback. What could we have done better? Just reply to this email.</p>

        <p>— The Audacious Money Team</p>
      </div>
    `,
    TextBody: `Subscription Cancelled

We've cancelled your subscription to ${productName} as requested.

Access until: ${endDate}
You can continue using ${productName} until ${endDate}. After that, your data will be preserved but access will be paused.

Changed Your Mind?
You can reactivate your subscription anytime by logging into your account and going to Settings → Subscriptions.

We're sorry to see you go, but we'd love to hear your feedback. What could we have done better? Just reply to this email.

— The Audacious Money Team`,
    MessageStream: 'outbound'
  });
}

/**
 * Send email verification email
 */
export async function sendEmailVerificationEmail(
  to: string,
  verificationToken: string,
  appUrl: string
): Promise<void> {
  const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;

  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Verify your email address',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Verify Your Email</h1>
        <p>Thanks for signing up! Please verify your email address to get started.</p>

        <div style="margin: 30px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Verify Email Address
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 14px; color: #2563eb; word-break: break-all;">${verifyUrl}</p>

        <p><strong>Didn't sign up?</strong> You can safely ignore this email.</p>

        <p>— The Audacious Money Team</p>
      </div>
    `,
    TextBody: `Verify Your Email

Thanks for signing up! Please verify your email address to get started.

Click this link to verify:
${verifyUrl}

Didn't sign up? You can safely ignore this email.

— The Audacious Money Team`,
    MessageStream: 'outbound'
  });
}

/**
 * Test email function (for testing Postmark integration)
 */
export async function sendTestEmail(to: string): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Postmark Test Email',
    HtmlBody: '<h1>Test Successful!</h1><p>Postmark is configured and working correctly.</p>',
    TextBody: 'Test Successful! Postmark is configured and working correctly.',
    MessageStream: 'outbound'
  });
}

/**
 * Send email verification email (for auth route compatibility)
 */
export async function sendVerificationEmail(
  email: string,
  userId: string,
  firstName: string
): Promise<void> {
  const appUrl = process.env.FRONTEND_URL || 'https://app.audacious.money';
  // For now, just send welcome email since email verification isn't required
  // In the future, this could send a verification token
  await sendWelcomeEmail(email, firstName, userId.substring(0, 8).toUpperCase());
}
