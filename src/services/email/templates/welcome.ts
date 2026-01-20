/**
 * Template 7: Welcome Email (Onboarding)
 *
 * Welcome email sent after user signs up
 */

import type { WelcomeEmailVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderWelcome(
  variables: WelcomeEmailVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{firstName}},
  </p>

  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; font-weight: 600;">
    Welcome to Graceful Books - accounting software that feels like a friend, not a chore.
  </p>

  <div style="margin: 20px 0; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #4A90E2; border-radius: 4px;">
    <p style="margin: 0; color: #14171a; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;">
      <strong>You're in control:</strong> Your financial data is encrypted with zero-knowledge architecture. We can't see your data, even if we wanted to.
    </p>
  </div>

  <p style="margin: 20px 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600;">
    What's next:
  </p>

  <ol style="margin: 0 0 30px 0; padding-left: 20px; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
    <li>Complete your business profile</li>
    <li>Connect your bank (or upload transactions manually)</li>
    <li>Start recording income and expenses</li>
  </ol>

  <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600;">
    Need help? We've got you:
  </p>

  <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
    <li>Guided tutorials (built into the app)</li>
    <li>Video walkthroughs (<a href="https://gracefulbooks.com/help" style="color: #4A90E2; text-decoration: none;">gracefulbooks.com/help</a>)</li>
    <li>Support team (<a href="mailto:support@gracefulbooks.com" style="color: #4A90E2; text-decoration: none;">support@gracefulbooks.com</a>)</li>
  </ul>

  ${createButton('Get Started', '{{dashboardUrl}}')}

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; font-style: italic;">
    P.S. - Your $5/month supports <strong>{{charityName}}</strong>. You're already making a difference.
  </p>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(false)}
  `;

  const plainTextBody = `
Hi {{firstName}},

Welcome to Graceful Books - accounting software that feels like a friend, not a chore.

You're in control: Your financial data is encrypted with zero-knowledge architecture. We can't see your data, even if we wanted to.

What's next:
1. Complete your business profile
2. Connect your bank (or upload transactions manually)
3. Start recording income and expenses

Need help? We've got you:
- Guided tutorials (built into the app)
- Video walkthroughs (gracefulbooks.com/help)
- Support team (support@gracefulbooks.com)

[Get Started] {{dashboardUrl}}

P.S. - Your $5/month supports {{charityName}}. You're already making a difference.

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
    subject: `Welcome to Graceful Books, ${variables.firstName}!`,
  };
}
