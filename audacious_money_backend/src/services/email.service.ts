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
        <h1 style="color: #4b006e;">Welcome to Audacious Money!</h1>
        <p>Hi there,</p>
        <p>We're thrilled to have you join us. You're taking an important step toward financial clarity and confidence.</p>

        <div style="background: #f9f5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D4AF37;">
          <h3 style="margin-top: 0; color: #4b006e;">Your Account Details</h3>
          <p><strong>Email:</strong> ${to}</p>
          <p><strong>Support Key:</strong> ${supportKey}</p>
          <p style="font-size: 14px; color: #6b7280;">Keep your Support Key safe - you'll need it if you ever contact our support team.</p>
        </div>

        <h3 style="color: #4b006e;">What's Next?</h3>
        <ol>
          <li>Complete your onboarding assessment</li>
          <li>Select your charity to support</li>
          <li>Start exploring your financial tools</li>
        </ol>

        <p>If you have any questions, just reply to this email. We're here to help!</p>

        <p>Take your time with this. We'll walk through everything together.</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
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
        <h1 style="color: #4b006e;">Your Trial Has Started!</h1>
        <p>Great news! Your 30-day trial of <strong>${productName}</strong> is now active.</p>

        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 0;"><strong>Trial ends:</strong> ${trialEndDate}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: #065f46;">No charges until your trial ends. Cancel anytime.</p>
        </div>

        <h3 style="color: #4b006e;">Make the Most of Your Trial</h3>
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
        <h1 style="color: #4b006e;">Reset Your Password</h1>
        <p>We received a request to reset your password for your Audacious Money account.</p>

        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #4b006e 0%, #6d28d9 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; border: 2px solid #D4AF37;">
            Reset Your Password
          </a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 14px; color: #4b006e; word-break: break-all;">${resetUrl}</p>

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

/**
 * Send account deleted confirmation email
 */
export async function sendAccountDeletedEmail(
  to: string,
  userName: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Your Audacious Money account has been deleted',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Account Deleted</h1>
        <p>Hi ${userName},</p>
        <p>We've successfully deleted your Audacious Money account as requested.</p>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0; font-size: 14px; color: #991b1b;">
            <strong>What's been deleted:</strong><br>
            • Your account and profile information<br>
            • All active subscriptions have been cancelled<br>
            • Your local financial data remains on your device
          </p>
        </div>

        <h3>Important Notes</h3>
        <p><strong>Financial Records:</strong> In accordance with legal requirements, certain financial transaction records may be retained for 7 years as required by accounting standards.</p>
        <p><strong>Local Data:</strong> Any data stored locally on your device has not been affected. You can delete this manually if needed.</p>
        <p><strong>Creating a New Account:</strong> You're welcome to create a new account anytime using the same email address.</p>

        <p>We're sorry to see you go. If you have any feedback about your experience, we'd genuinely appreciate hearing from you. Just reply to this email.</p>

        <p>Thank you for being part of the Audacious Money community.</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Account Deleted

Hi ${userName},

We've successfully deleted your Audacious Money account as requested.

What's been deleted:
• Your account and profile information
• All active subscriptions have been cancelled
• Your local financial data remains on your device

Important Notes:

Financial Records: In accordance with legal requirements, certain financial transaction records may be retained for 7 years as required by accounting standards.

Local Data: Any data stored locally on your device has not been affected. You can delete this manually if needed.

Creating a New Account: You're welcome to create a new account anytime using the same email address.

We're sorry to see you go. If you have any feedback about your experience, we'd genuinely appreciate hearing from you. Just reply to this email.

Thank you for being part of the Audacious Money community.

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send account deactivated confirmation email
 */
export async function sendAccountDeactivatedEmail(
  to: string,
  userName: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Your Audacious Money account has been deactivated',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Account Deactivated</h1>
        <p>Hi ${userName},</p>
        <p>We've deactivated your Audacious Money account as requested. Take all the time you need - we'll be here when you're ready to come back.</p>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>What this means:</strong><br>
            • You won't be able to log in until you reactivate<br>
            • All active subscriptions have been cancelled<br>
            • Your account data is safely preserved<br>
            • Your local financial data remains on your device
          </p>
        </div>

        <h3>Ready to Come Back?</h3>
        <p>You can reactivate your account anytime by logging in. Simply enter your email and password, and we'll reactivate your account immediately.</p>

        <p>No pressure. We're here whenever you're ready.</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Account Deactivated

Hi ${userName},

We've deactivated your Audacious Money account as requested. Take all the time you need - we'll be here when you're ready to come back.

What this means:
• You won't be able to log in until you reactivate
• All active subscriptions have been cancelled
• Your account data is safely preserved
• Your local financial data remains on your device

Ready to Come Back?

You can reactivate your account anytime by logging in. Simply enter your email and password, and we'll reactivate your account immediately.

No pressure. We're here whenever you're ready.

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send account reactivated confirmation email
 */
export async function sendAccountReactivatedEmail(
  to: string,
  userName: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'Welcome back to Audacious Money! 🌟',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4b006e;">Welcome Back!</h1>
        <p>Hi ${userName},</p>
        <p>We're so glad to have you back! Your account has been successfully reactivated.</p>

        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 0; font-size: 14px; color: #065f46;">
            <strong>You're all set!</strong><br>
            • Your account is now active<br>
            • All your data has been preserved<br>
            • You can start where you left off
          </p>
        </div>

        <h3>What's Next?</h3>
        <p>If you'd like to subscribe to any of our products, just head to Settings → Subscriptions to explore your options.</p>

        <p>If you need any help getting back into the swing of things, just reply to this email. We're here to support you.</p>

        <p>It's great to have you back!</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Welcome Back!

Hi ${userName},

We're so glad to have you back! Your account has been successfully reactivated.

You're all set!
• Your account is now active
• All your data has been preserved
• You can start where you left off

What's Next?

If you'd like to subscribe to any of our products, just head to Settings → Subscriptions to explore your options.

If you need any help getting back into the swing of things, just reply to this email. We're here to support you.

It's great to have you back!

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send subscription paused confirmation email
 */
export async function sendSubscriptionPausedEmail(
  to: string,
  userName: string,
  productName: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `Your ${productName} subscription has been paused`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Subscription Paused</h1>
        <p>Hi ${userName},</p>
        <p>We've paused your subscription to <strong>${productName}</strong> as requested. We totally understand - life happens!</p>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>What this means:</strong><br>
            • You won't be charged while paused<br>
            • You can still view all your data anytime<br>
            • Editing features are temporarily unavailable<br>
            • Reactivate whenever you're ready
          </p>
        </div>

        <h3>Your Data is Safe</h3>
        <p>All your financial data remains secure and accessible. You can log in anytime to view, export, or download your information.</p>

        <h3>Ready to Resume?</h3>
        <p>When you're ready to start adding and editing again, just head to Billing and click "Activate Subscription". We'll be here whenever you need us.</p>

        <p>Take your time - there's no rush. We're here to support you.</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Subscription Paused

Hi ${userName},

We've paused your subscription to ${productName} as requested. We totally understand - life happens!

What this means:
• You won't be charged while paused
• You can still view all your data anytime
• Editing features are temporarily unavailable
• Reactivate whenever you're ready

Your Data is Safe

All your financial data remains secure and accessible. You can log in anytime to view, export, or download your information.

Ready to Resume?

When you're ready to start adding and editing again, just head to Billing and click "Activate Subscription". We'll be here whenever you need us.

Take your time - there's no rush. We're here to support you.

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send subscription resumed confirmation email
 */
export async function sendSubscriptionResumedEmail(
  to: string,
  userName: string,
  productName: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `Welcome back! Your ${productName} subscription is active`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4b006e;">Subscription Reactivated! 🎉</h1>
        <p>Hi ${userName},</p>
        <p>Great news! Your subscription to <strong>${productName}</strong> is now active. You're all set to start adding and editing your financial data again.</p>

        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 0; font-size: 14px; color: #065f46;">
            <strong>What's unlocked:</strong><br>
            • Full access to add new transactions<br>
            • Edit and update existing records<br>
            • Create invoices and manage clients<br>
            • All features are available again
          </p>
        </div>

        <p>Your monthly billing has resumed, and you'll see a charge for the current billing period on your card on file.</p>

        <p>If you have any questions or need help getting back into the flow, just reply to this email. We're here for you!</p>

        <p>It's great to have you back!</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Subscription Reactivated!

Hi ${userName},

Great news! Your subscription to ${productName} is now active. You're all set to start adding and editing your financial data again.

What's unlocked:
• Full access to add new transactions
• Edit and update existing records
• Create invoices and manage clients
• All features are available again

Your monthly billing has resumed, and you'll see a charge for the current billing period on your card on file.

If you have any questions or need help getting back into the flow, just reply to this email. We're here for you!

It's great to have you back!

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send payment failed with grace period notification
 */
export async function sendPaymentFailedGracePeriodEmail(
  to: string,
  userName: string,
  productName: string,
  gracePeriodEndDate: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `Payment failed - 3-day grace period for ${productName}`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Payment Unsuccessful</h1>
        <p>Hi ${userName},</p>
        <p>We tried to process your payment for <strong>${productName}</strong>, but it didn't go through. These things happen - no worries!</p>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>You have a 3-day grace period:</strong><br>
            • Full access continues until ${gracePeriodEndDate}<br>
            • Update your payment method in Billing<br>
            • We'll retry automatically<br>
            • No interruption if updated within 3 days
          </p>
        </div>

        <h3>How to Update Your Payment</h3>
        <ol>
          <li>Log in to your account</li>
          <li>Go to Billing</li>
          <li>Click "Update Payment Method"</li>
          <li>Enter your new card details</li>
        </ol>

        <p><strong>What happens after the grace period?</strong> If payment isn't updated by ${gracePeriodEndDate}, your subscription will pause. You'll still be able to view all your data, but editing features will be temporarily unavailable until payment is updated.</p>

        <p>If you're experiencing financial difficulty, please know we understand. You can always pause your subscription and keep view-only access to your data.</p>

        <p>Need help? Just reply to this email. We're here for you.</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Payment Unsuccessful

Hi ${userName},

We tried to process your payment for ${productName}, but it didn't go through. These things happen - no worries!

You have a 3-day grace period:
• Full access continues until ${gracePeriodEndDate}
• Update your payment method in Billing
• We'll retry automatically
• No interruption if updated within 3 days

How to Update Your Payment:
1. Log in to your account
2. Go to Billing
3. Click "Update Payment Method"
4. Enter your new card details

What happens after the grace period? If payment isn't updated by ${gracePeriodEndDate}, your subscription will pause. You'll still be able to view all your data, but editing features will be temporarily unavailable until payment is updated.

If you're experiencing financial difficulty, please know we understand. You can always pause your subscription and keep view-only access to your data.

Need help? Just reply to this email. We're here for you.

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send grace period ending soon reminder (1 day before)
 */
export async function sendGracePeriodEndingSoonEmail(
  to: string,
  userName: string,
  productName: string,
  gracePeriodEndDate: string
): Promise<void> {
  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: `Grace period ends tomorrow - ${productName}`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Grace Period Ends Tomorrow</h1>
        <p>Hi ${userName},</p>
        <p>This is a friendly reminder that your 3-day grace period for <strong>${productName}</strong> ends tomorrow (${gracePeriodEndDate}).</p>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0; font-size: 14px; color: #991b1b;">
            <strong>Action needed:</strong><br>
            Please update your payment method by ${gracePeriodEndDate} to maintain full access.
          </p>
        </div>

        <h3>Update Payment Now</h3>
        <p>Log in to your account and go to Billing → Update Payment Method to keep editing access.</p>

        <h3>What Happens If I Don't Update?</h3>
        <p>After ${gracePeriodEndDate}, your subscription will automatically pause. You'll still have:</p>
        <ul>
          <li>Full access to view all your data</li>
          <li>Ability to export and download your records</li>
          <li>Read-only access to all reports</li>
        </ul>
        <p>Editing features will be temporarily unavailable until payment is updated.</p>

        <p>We understand that life gets busy. If you need help or have questions, just reply to this email.</p>

        <p>— The Audacious Money Team</p>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      </div>
    `,
    TextBody: `Grace Period Ends Tomorrow

Hi ${userName},

This is a friendly reminder that your 3-day grace period for ${productName} ends tomorrow (${gracePeriodEndDate}).

Action needed:
Please update your payment method by ${gracePeriodEndDate} to maintain full access.

Update Payment Now

Log in to your account and go to Billing → Update Payment Method to keep editing access.

What Happens If I Don't Update?

After ${gracePeriodEndDate}, your subscription will automatically pause. You'll still have:
- Full access to view all your data
- Ability to export and download your records
- Read-only access to all reports

Editing features will be temporarily unavailable until payment is updated.

We understand that life gets busy. If you need help or have questions, just reply to this email.

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.`,
    MessageStream: 'outbound'
  });
}

/**
 * Send CPG Product Costing Tool launch signup confirmation
 */
export async function sendCPGLaunchSignupEmail(
  to: string,
  firstName: string,
  signupId: string
): Promise<void> {
  const unsubscribeUrl = `https://audacious.money/cpg-unsubscribe?id=${signupId}`;

  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: to,
    Subject: 'You\'re on the list! Product Costing Tool launches May 4th 🚀',
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4b006e; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">You're In! 🎉</h1>
        </div>

        <div style="padding: 40px; background: #faf8f5;">
          <p style="font-size: 18px; color: #4b006e;">Hey ${firstName},</p>

          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Congrats on taking this step to gain clarity over your numbers. We're excited to have you on the list for the <strong>Product Costing Tool</strong> launch.
          </p>

          <div style="background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #D4AF37; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #4b006e;">Mark Your Calendar</h3>
            <p style="font-size: 20px; font-weight: bold; color: #2d5016; margin: 10px 0;">
              May 4th, 2026
            </p>
            <p style="color: #666; font-size: 14px; margin: 0;">
              You'll get an email the moment we launch with everything you need to get started.
            </p>
          </div>

          <h3 style="color: #4b006e;">What You'll Get</h3>
          <ul style="line-height: 1.8; color: #333;">
            <li><strong>CPG Trends & Clarity</strong> - See what's working with crystal-clear insights</li>
            <li><strong>Distribution Fees Decoded</strong> - Know exactly what fees mean for you</li>
            <li><strong>Promo Analysis</strong> - Walk into big retailer deals with confidence</li>
            <li><strong>Event Tracking</strong> - Know which events move the needle</li>
            <li><strong>Strategy Planning</strong> - Test "what-if" scenarios before you commit</li>
          </ul>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0; font-size: 16px; color: #333; line-height: 1.6;">
              <strong style="color: #4b006e;">This is about money confidence.</strong> The numbers are the language your business is communicating to you through—we're here to help you listen.
            </p>
          </div>

          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Get ready to gain clarity, make bold decisions, and set that entrepreneurial spirit on fire. 🔥
          </p>

          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            If you have any questions in the meantime, just reply to this email. We're here for you.
          </p>

          <p style="margin-top: 30px;">
            — The Audacious Money Team
          </p>

          <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Audacious Money<br>
            Building financial confidence, one step at a time.
          </p>

          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 20px;">
            Changed your mind? <a href="${unsubscribeUrl}" style="color: #4b006e; text-decoration: underline;">Unsubscribe</a> and head back to the sand—we'll be here when you're ready to come out.
          </p>
        </div>
      </div>
    `,
    TextBody: `You're In! 🎉

Hey ${firstName},

Congrats on taking this step to gain clarity over your numbers. We're excited to have you on the list for the Product Costing Tool launch.

MARK YOUR CALENDAR
May 4th, 2026

You'll get an email the moment we launch with everything you need to get started.

What You'll Get:
- CPG Trends & Clarity - See what's working with crystal-clear insights
- Distribution Fees Decoded - Know exactly what fees mean for you
- Promo Analysis - Walk into big retailer deals with confidence
- Event Tracking - Know which events move the needle
- Strategy Planning - Test "what-if" scenarios before you commit

This is about money confidence. The numbers are the language your business is communicating to you through—we're here to help you listen.

Get ready to gain clarity, make bold decisions, and set that entrepreneurial spirit on fire. 🔥

If you have any questions in the meantime, just reply to this email. We're here for you.

— The Audacious Money Team

Audacious Money
Building financial confidence, one step at a time.

Changed your mind? Unsubscribe and head back to the sand—we'll be here when you're ready to come out: ${unsubscribeUrl}`,
    MessageStream: 'outbound'
  });
}

/**
 * Send contact form submission to hello@audacious.money
 */
export async function sendContactFormEmail(
  name: string,
  email: string,
  subject: string,
  message: string
): Promise<void> {
  const subjectMap: Record<string, string> = {
    'general': 'General Inquiry',
    'support': 'Technical Support',
    'billing': 'Billing Question',
    'feature': 'Feature Request',
    'bug': 'Bug Report',
    'feedback': 'Feedback',
    'other': 'Other'
  };

  const subjectLine = subjectMap[subject] || 'Contact Form Submission';

  await client.sendEmail({
    From: `${FROM_NAME} <${FROM_EMAIL}>`,
    To: FROM_EMAIL, // Send to hello@audacious.money (or noreply@audacious.money based on your FROM_EMAIL)
    ReplyTo: email, // User's email for easy reply
    Subject: `[Contact Form] ${subjectLine} - ${name}`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4b006e;">New Contact Form Submission</h1>

        <div style="background: #f9f5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D4AF37;">
          <h3 style="margin-top: 0; color: #4b006e;">Contact Details</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #4b006e;">${email}</a></p>
          <p><strong>Subject:</strong> ${subjectLine}</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e0e0e0;">
          <h3 style="margin-top: 0; color: #4b006e;">Message</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
        </div>

        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          This message was sent via the Audacious Money contact form.<br>
          Reply directly to this email to respond to ${name}.
        </p>
      </div>
    `,
    TextBody: `New Contact Form Submission

Contact Details:
- Name: ${name}
- Email: ${email}
- Subject: ${subjectLine}

Message:
${message}

---
This message was sent via the Audacious Money contact form.
Reply directly to this email to respond to ${name}.`,
    MessageStream: 'outbound'
  });
}
