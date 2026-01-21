/**
 * Template 5: Tax Season Access Granted (J8)
 *
 * Notification when advisor grants tax prep mode access
 */

import type { TaxSeasonAccessVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderTaxSeasonAccess(
  variables: TaxSeasonAccessVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{clientFirstName}},
  </p>

  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>{{advisorName}}</strong> has granted you access to Tax Prep Mode for tax year <strong>{{taxYear}}</strong>.
  </p>

  <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>You can now:</strong>
  </p>

  <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
    <li>Generate tax reports (P&L, Balance Sheet, Transaction Summary)</li>
    <li>Download your tax document checklist</li>
    <li>Export your data package for your tax preparer</li>
  </ul>

  <p style="margin: 0 0 30px 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>Access ends:</strong> {{accessExpiresDate}}
  </p>

  ${createButton('Open Tax Prep Mode', '{{taxPrepUrl}}')}

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Questions about tax prep? Contact <a href="mailto:{{advisorEmail}}" style="color: #4A90E2; text-decoration: none;">{{advisorEmail}}</a>
  </p>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(true)}
  `;

  const plainTextBody = `
Hi {{clientFirstName}},

{{advisorName}} has granted you access to Tax Prep Mode for tax year {{taxYear}}.

You can now:
- Generate tax reports (P&L, Balance Sheet, Transaction Summary)
- Download your tax document checklist
- Export your data package for your tax preparer

Access ends: {{accessExpiresDate}}

[Open Tax Prep Mode] {{taxPrepUrl}}

Questions about tax prep? Contact {{advisorEmail}}

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
    subject: `${variables.advisorName} granted you access to Tax Prep Mode`,
  };
}
