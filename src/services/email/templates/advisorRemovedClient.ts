/**
 * Template 3: Advisor Removed Client Notification (J7)
 *
 * Notification when advisor removes client from their plan
 */

import type { AdvisorRemovedClientVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderAdvisorRemovedClient(
  variables: AdvisorRemovedClientVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{clientFirstName}},
  </p>

  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>{{advisorName}}</strong> has transferred billing for your Graceful Books account back to you.
  </p>

  <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>What happens next:</strong>
  </p>

  <ol style="margin: 0 0 20px 0; padding-left: 20px; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
    <li>
      <strong>Log in to choose your billing option:</strong>
      <ul style="margin-top: 5px; list-style-type: disc;">
        <li>Pay individually ($40/month) to keep full access</li>
        <li>Archive your account (free, read-only access)</li>
      </ul>
    </li>
    <li style="margin-top: 10px;">
      <strong>You have 14 days to decide</strong> (grace period - no charge)
    </li>
  </ol>

  <p style="margin: 0 0 30px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>Your data is safe:</strong> All your financial records remain secure and accessible.
  </p>

  ${createButton('Choose Billing Option', '{{billingChoiceUrl}}')}

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

{{advisorName}} has transferred billing for your Graceful Books account back to you.

What happens next:

1. Log in to choose your billing option:
   - Pay individually ($40/month) to keep full access
   - Archive your account (free, read-only access)

2. You have 14 days to decide (grace period - no charge)

Your data is safe: All your financial records remain secure and accessible.

[Choose Billing Option] {{billingChoiceUrl}}

Questions? Email support@gracefulbooks.com

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
    subject: 'Your Graceful Books billing has been transferred back to you',
  };
}
