/**
 * Template 2: Client Billing Transfer Notification (J7)
 *
 * Notification when client's billing is transferred to advisor
 */

import type { ClientBillingTransferVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderClientBillingTransfer(
  variables: ClientBillingTransferVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{clientFirstName}},
  </p>

  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Good news: <strong>{{advisorName}}</strong> is now covering your Graceful Books subscription.
  </p>

  <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>What changed:</strong>
  </p>

  <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
    <li>Your individual billing ($40/month) has been paused</li>
    <li>{{advisorName}} now pays for your account as part of their advisor plan</li>
    <li>You keep full access to all your data and features</li>
    <li>You can still invite team members and manage your books</li>
  </ul>

  <p style="margin: 0 0 30px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>No action needed.</strong> Everything continues as normal.
  </p>

  ${createButton('View Account Details', '{{accountUrl}}')}

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Questions? Email <a href="mailto:{{advisorEmail}}" style="color: #4A90E2; text-decoration: none;">{{advisorEmail}}</a> or <a href="mailto:support@gracefulbooks.com" style="color: #4A90E2; text-decoration: none;">support@gracefulbooks.com</a>
  </p>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(true)}
  `;

  const plainTextBody = `
Hi {{clientFirstName}},

Good news: {{advisorName}} is now covering your Graceful Books subscription.

What changed:
- Your individual billing ($40/month) has been paused
- {{advisorName}} now pays for your account as part of their advisor plan
- You keep full access to all your data and features
- You can still invite team members and manage your books

No action needed. Everything continues as normal.

[View Account Details] {{accountUrl}}

Questions? Email {{advisorEmail}} or support@gracefulbooks.com

- The Graceful Books Team

---
Help Center: https://gracefulbooks.com/help
Contact Support: https://gracefulbooks.com/contact
Privacy Policy: https://gracefulbooks.com/privacy

© ${new Date().getFullYear()} Graceful Books. All rights reserved.
  `.trim();

  return {
    html: replaceVariables(htmlBody, variables as Record<string, string>, true),
    plainText: replaceVariables(plainTextBody, variables as Record<string, string>, false),
    subject: `Your Graceful Books billing has been transferred to ${variables.advisorName}`,
  };
}
