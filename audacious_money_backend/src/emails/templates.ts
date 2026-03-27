/**
 * Email templates for Audacious Money platform
 *
 * All templates include HTML and plain text versions
 * Tone: Fun, engaging, kind, encouraging without being obnoxious
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Email verification template
 *
 * Variables:
 * - {{firstName}} - User's first name
 * - {{verificationLink}} - Link to verify email
 */
export const emailVerificationTemplate: EmailTemplate = {
  subject: 'Welcome to Audacious Money - Please verify your email',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Audacious Money</h1>
        </div>
        <div class="content">
          <p>Hi {{firstName}},</p>
          <p>Thank you for creating your account. You're one simple step away from getting started with your financial journey.</p>
          <p>Here's what happens next: Click the button below to verify your email address. This helps us keep your account secure.</p>
          <p style="text-align: center;">
            <a href="{{verificationLink}}" class="button">Verify My Email</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">{{verificationLink}}</p>
          <p>This link will expire in 24 hours for security reasons. If you need a new link, just let us know.</p>
          <p>Take your time, and we're here if you have any questions.</p>
          <p>Warmly,<br>The Audacious Money Team</p>
        </div>
        <div class="footer">
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  text: `
Welcome to Audacious Money

Hi {{firstName}},

Thank you for creating your account. You're one simple step away from getting started with your financial journey.

Here's what happens next: Click this link to verify your email address. This helps us keep your account secure.

{{verificationLink}}

This link will expire in 24 hours for security reasons. If you need a new link, just let us know.

Take your time, and we're here if you have any questions.

Warmly,
The Audacious Money Team

---
If you didn't create an account, you can safely ignore this email.
  `,
};

/**
 * Password reset template
 *
 * Variables:
 * - {{firstName}} - User's first name
 * - {{resetLink}} - Link to reset password
 */
export const passwordResetTemplate: EmailTemplate = {
  subject: 'Reset your Audacious Money password',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hi {{firstName}},</p>
          <p>We received a request to reset your password. No worries - it happens to the best of us!</p>
          <p>Click the button below to create a new password:</p>
          <p style="text-align: center;">
            <a href="{{resetLink}}" class="button">Reset My Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">{{resetLink}}</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>Stay secure,<br>The Audacious Money Team</p>
        </div>
        <div class="footer">
          <p>If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  text: `
Reset Your Password

Hi {{firstName}},

We received a request to reset your password. No worries - it happens to the best of us!

Click this link to create a new password:
{{resetLink}}

This link will expire in 1 hour for security reasons.

Stay secure,
The Audacious Money Team

---
If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
  `,
};

/**
 * Trial started template
 *
 * Variables:
 * - {{firstName}} - User's first name
 * - {{productName}} - Product name
 * - {{trialEndDate}} - Trial end date
 */
export const trialStartedTemplate: EmailTemplate = {
  subject: 'Your {{productName}} trial is now active',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .highlight { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Trial is Active</h1>
        </div>
        <div class="content">
          <p>Hi {{firstName}},</p>
          <p>Your 14-day trial of <strong>{{productName}}</strong> is now active. You have full access to explore everything at your own pace.</p>
          <div class="highlight">
            <p><strong>Here's what's included in your trial:</strong></p>
            <ul>
              <li>Full access to all features</li>
              <li>No credit card required</li>
              <li>$5 donation to your chosen charity when you convert</li>
            </ul>
          </div>
          <p>Your trial will end on <strong>{{trialEndDate}}</strong>. We'll send you a friendly reminder a few days before, so there are no surprises.</p>
          <p>Take your time exploring {{productName}}. There's no rush - everything will be here when you're ready. We're here to support you along the way.</p>
          <p>Warmly,<br>The Audacious Money Team</p>
        </div>
        <div class="footer">
          <p>Questions? Just reply to this email - we're here to help.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  text: `
Your Trial is Active

Hi {{firstName}},

Your 14-day trial of {{productName}} is now active. You have full access to explore everything at your own pace.

Here's what's included in your trial:
- Full access to all features
- No credit card required
- $5 donation to your chosen charity when you convert

Your trial will end on {{trialEndDate}}. We'll send you a friendly reminder a few days before, so there are no surprises.

Take your time exploring {{productName}}. There's no rush - everything will be here when you're ready. We're here to support you along the way.

Warmly,
The Audacious Money Team

---
Questions? Just reply to this email - we're here to help.
  `,
};

/**
 * Payment failed template
 *
 * Variables:
 * - {{firstName}} - User's first name
 * - {{productName}} - Product name
 * - {{failureReason}} - Reason for payment failure
 */
export const paymentFailedTemplate: EmailTemplate = {
  subject: 'Oops! There was an issue with your payment',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Update Needed</h1>
        </div>
        <div class="content">
          <p>Hi {{firstName}},</p>
          <p>We tried to process your payment for <strong>{{productName}}</strong>, but it didn't go through.</p>
          <p><strong>Reason:</strong> {{failureReason}}</p>
          <p>No worries - this happens! Here's what you can do:</p>
          <ul>
            <li>Update your payment method in your account settings</li>
            <li>Make sure your card has sufficient funds</li>
            <li>Check that your billing address is correct</li>
          </ul>
          <p style="text-align: center;">
            <a href="{{accountLink}}" class="button">Update Payment Method</a>
          </p>
          <p>Your access to {{productName}} will remain active for the next 7 days while you update your payment information.</p>
          <p>Here to help,<br>The Audacious Money Team</p>
        </div>
        <div class="footer">
          <p>Need assistance? Reply to this email or contact us at support@audaciousmoney.com</p>
        </div>
      </div>
    </body>
    </html>
  `,
  text: `
Payment Update Needed

Hi {{firstName}},

We tried to process your payment for {{productName}}, but it didn't go through.

Reason: {{failureReason}}

No worries - this happens! Here's what you can do:
- Update your payment method in your account settings
- Make sure your card has sufficient funds
- Check that your billing address is correct

Your access to {{productName}} will remain active for the next 7 days while you update your payment information.

Here to help,
The Audacious Money Team

---
Need assistance? Reply to this email or contact us at support@audaciousmoney.com
  `,
};

/**
 * Support session granted template
 *
 * Variables:
 * - {{firstName}} - User's first name
 * - {{supportDuration}} - Duration of support access (e.g., "24 hours")
 */
export const supportSessionGrantedTemplate: EmailTemplate = {
  subject: 'Your support session has been granted',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .alert { background: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Support Session Active</h1>
        </div>
        <div class="content">
          <p>Hi {{firstName}},</p>
          <p>We've granted a support agent temporary access to your account to help resolve your issue.</p>
          <div class="alert">
            <p><strong>Important:</strong></p>
            <ul>
              <li>Access will expire in {{supportDuration}}</li>
              <li>The agent can view your data but cannot make changes without your permission</li>
              <li>All actions are logged for security</li>
            </ul>
          </div>
          <p>We're committed to getting you back on track as quickly as possible!</p>
          <p>With care,<br>The Audacious Money Team</p>
        </div>
        <div class="footer">
          <p>You'll receive another email when the support session ends.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  text: `
Support Session Active

Hi {{firstName}},

We've granted a support agent temporary access to your account to help resolve your issue.

Important:
- Access will expire in {{supportDuration}}
- The agent can view your data but cannot make changes without your permission
- All actions are logged for security

We're committed to getting you back on track as quickly as possible!

With care,
The Audacious Money Team

---
You'll receive another email when the support session ends.
  `,
};

/**
 * Render a template with variables
 *
 * @param template - Email template to render
 * @param variables - Key-value pairs to replace in template
 * @returns Rendered template with variables replaced
 */
export function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): EmailTemplate {
  let { subject, html, text } = template;

  // Replace all variables in subject, html, and text
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), value);
    html = html.replace(new RegExp(placeholder, 'g'), value);
    text = text.replace(new RegExp(placeholder, 'g'), value);
  }

  return { subject, html, text };
}
