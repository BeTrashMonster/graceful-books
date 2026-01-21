/**
 * Template 9: Email Verification
 *
 * Critical account security email (cannot be unsubscribed)
 */

import type { EmailVerificationVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderEmailVerification(
  variables: EmailVerificationVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{firstName}},
  </p>

  <p style="margin: 0 0 30px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Welcome to Graceful Books! Let's verify your email address to secure your account.
  </p>

  ${createButton('Verify Email Address', '{{verificationUrl}}')}

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    This link expires in <strong>24 hours</strong>.
  </p>

  <div style="margin: 30px 0; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #4A90E2; border-radius: 4px;">
    <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600;">
      Why verify?
    </p>
    <ul style="margin: 0; padding-left: 20px; color: #14171a; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
      <li>Protect your account from unauthorized access</li>
      <li>Enable password reset if you ever need it</li>
      <li>Receive important account notifications</li>
    </ul>
  </div>

  <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
    <p style="margin: 0; color: #856404; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;">
      <strong>Didn't create an account?</strong> Email <a href="mailto:security@gracefulbooks.com" style="color: #856404; text-decoration: underline;">security@gracefulbooks.com</a> immediately.
    </p>
  </div>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(false)}
  `;

  const plainTextBody = `
Hi {{firstName}},

Welcome to Graceful Books! Let's verify your email address to secure your account.

[Verify Email Address] {{verificationUrl}}

This link expires in 24 hours.

Why verify?
- Protect your account from unauthorized access
- Enable password reset if you ever need it
- Receive important account notifications

Didn't create an account? Email security@gracefulbooks.com immediately.

- The Graceful Books Team

---
Help Center: https://gracefulbooks.com/help
Contact Support: https://gracefulbooks.com/contact
Privacy Policy: https://gracefulbooks.com/privacy

© ${new Date().getFullYear()} Graceful Books. All rights reserved.
  `.trim();

  return {
    html: replaceVariables(htmlBody, variables as unknown as Record<string, string>, true),
    plainText: replaceVariables(plainTextBody, variables as unknown as Record<string, string>, false),
    subject: 'Verify your email address for Graceful Books',
  };
}
