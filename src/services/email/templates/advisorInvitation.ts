/**
 * Template 1: Advisor Invitation (J7)
 *
 * Notification-only email when advisor invites client to connect
 */

import type { AdvisorInvitationVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderAdvisorInvitation(
  variables: AdvisorInvitationVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{clientFirstName}},
  </p>

  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>{{advisorName}}</strong> ({{advisorFirm}}) has invited you to connect your Graceful Books account to their advisor portal.
  </p>

  <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    This will allow {{advisorName}} to:
  </p>

  <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
    <li>View your financial reports (read-only access)</li>
    <li>Help you with bookkeeping and tax preparation</li>
    <li>Your billing will transfer to their plan (no charge to you)</li>
  </ul>

  <p style="margin: 0 0 30px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>You remain in control:</strong> You can revoke access at any time.
  </p>

  ${createButton('View Invitation & Accept', '{{invitationUrl}}')}

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Questions? Email us at <a href="mailto:support@gracefulbooks.com" style="color: #4A90E2; text-decoration: none;">support@gracefulbooks.com</a>
  </p>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(true)}
  `;

  const plainTextBody = `
Hi {{clientFirstName}},

{{advisorName}} ({{advisorFirm}}) has invited you to connect your Graceful Books account to their advisor portal.

This will allow {{advisorName}} to:
- View your financial reports (read-only access)
- Help you with bookkeeping and tax preparation
- Your billing will transfer to their plan (no charge to you)

You remain in control: You can revoke access at any time.

[View Invitation & Accept] {{invitationUrl}}

Questions? Email us at support@gracefulbooks.com

- The Graceful Books Team

---
Help Center: https://gracefulbooks.com/help
Contact Support: https://gracefulbooks.com/contact
Privacy Policy: https://gracefulbooks.com/privacy

© ${new Date().getFullYear()} Graceful Books. All rights reserved.
Accounting software that feels like a friend, not a chore.
  `.trim();

  return {
    html: replaceVariables(htmlBody, variables as Record<string, string>, true),
    plainText: replaceVariables(plainTextBody, variables as Record<string, string>, false),
    subject: `${variables.advisorName} invited you to connect your Graceful Books account`,
  };
}
