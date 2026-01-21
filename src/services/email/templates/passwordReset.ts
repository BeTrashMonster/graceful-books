/**
 * Template 8: Password Reset
 *
 * Critical security email for password reset (cannot be unsubscribed)
 */

import type { PasswordResetVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderPasswordReset(
  variables: PasswordResetVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{firstName}},
  </p>

  <p style="margin: 0 0 30px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    We received a request to reset your Graceful Books password.
  </p>

  ${createButton('Reset Password', '{{resetUrl}}')}

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    This link expires in <strong>1 hour</strong>.
  </p>

  <div style="margin: 30px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
    <p style="margin: 0; color: #856404; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;">
      <strong>Didn't request a reset?</strong> Ignore this email - your password is still secure.
    </p>
  </div>

  <div style="margin: 20px 0; padding: 15px; background-color: #f0f8ff; border-left: 4px solid #4A90E2; border-radius: 4px;">
    <p style="margin: 0; color: #14171a; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;">
      <strong>Security tip:</strong> Never share your password or master passphrase with anyone (including Graceful Books support).
    </p>
  </div>

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Questions? Email <a href="mailto:security@gracefulbooks.com" style="color: #4A90E2; text-decoration: none;">security@gracefulbooks.com</a>
  </p>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(false)}
  `;

  const plainTextBody = `
Hi {{firstName}},

We received a request to reset your Graceful Books password.

[Reset Password] {{resetUrl}}

This link expires in 1 hour.

Didn't request a reset? Ignore this email - your password is still secure.

Security tip: Never share your password or master passphrase with anyone (including Graceful Books support).

Questions? Email security@gracefulbooks.com

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
    subject: 'Reset your Graceful Books password',
  };
}
