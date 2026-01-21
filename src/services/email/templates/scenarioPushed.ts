/**
 * Template 4: Scenario Pushed to Client (J3 + J7)
 *
 * Notification when advisor shares a scenario analysis
 */

import type { ScenarioPushedVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderScenarioPushed(
  variables: ScenarioPushedVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{clientFirstName}},
  </p>

  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>{{advisorName}}</strong> has shared a financial scenario analysis with you in Graceful Books.
  </p>

  <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>Scenario:</strong> "{{scenarioName}}"
  </p>

  <div style="margin: 20px 0; padding: 20px; background-color: #f5f7fa; border-left: 4px solid #4A90E2; border-radius: 4px;">
    <p style="margin: 0; color: #14171a; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; font-style: italic;">
      "{{advisorNote}}"
    </p>
    <p style="margin: 10px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      — {{advisorName}}
    </p>
  </div>

  ${createButton('View Scenario', '{{scenarioUrl}}')}

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    This scenario shows projected financials based on assumptions. Log in to see the full analysis.
  </p>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(true)}
  `;

  const plainTextBody = `
Hi {{clientFirstName}},

{{advisorName}} has shared a financial scenario analysis with you in Graceful Books.

Scenario: "{{scenarioName}}"

{{advisorName}} added a note:
"{{advisorNote}}"

[View Scenario] {{scenarioUrl}}

This scenario shows projected financials based on assumptions. Log in to see the full analysis.

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
    subject: `${variables.advisorName} shared a financial scenario with you`,
  };
}
