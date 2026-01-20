/**
 * Template 6: Tax Prep Completion Summary (J8)
 *
 * Notification when tax package is ready for download
 */

import type { TaxPrepCompletionVariables } from '../../../types/ic4-email.types';
import {
  getEmailHeader,
  getEmailFooter,
  wrapEmailBody,
  createButton,
  replaceVariables,
} from '../templateUtils';

export function renderTaxPrepCompletion(
  variables: TaxPrepCompletionVariables
): { html: string; plainText: string; subject: string } {
  const htmlBody = `
${getEmailHeader()}
${wrapEmailBody(`
  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Hi {{firstName}},
  </p>

  <p style="margin: 0 0 20px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Great work! Your tax preparation package for <strong>{{taxYear}}</strong> is ready to download.
  </p>

  <div style="margin: 20px 0; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #4A90E2; border-radius: 4px;">
    <p style="margin: 0 0 10px 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600;">
      What's included:
    </p>
    <ul style="margin: 0; padding-left: 20px; color: #14171a; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8;">
      <li>Income reports (complete transaction history)</li>
      <li>Expense reports (categorized by tax category)</li>
      <li>Deduction checklist (your completed review)</li>
      <li>Export package (ZIP file with all data)</li>
    </ul>
  </div>

  ${createButton('Download Tax Package', '{{downloadUrl}}')}

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    <strong>Next step:</strong> Share this package with your tax preparer or accountant.
  </p>

  <p style="margin: 20px 0 0 0; color: #657786; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
    Need help? Email <a href="mailto:support@gracefulbooks.com" style="color: #4A90E2; text-decoration: none;">support@gracefulbooks.com</a>
  </p>

  <p style="margin: 20px 0 0 0; color: #14171a; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    - The Graceful Books Team
  </p>
`)}
${getEmailFooter(true)}
  `;

  const plainTextBody = `
Hi {{firstName}},

Great work! Your tax preparation package for {{taxYear}} is ready to download.

What's included:
- Income reports (complete transaction history)
- Expense reports (categorized by tax category)
- Deduction checklist (your completed review)
- Export package (ZIP file with all data)

[Download Tax Package] {{downloadUrl}}

Next step: Share this package with your tax preparer or accountant.

Need help? Email support@gracefulbooks.com

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
    subject: `Your ${variables.taxYear} tax prep package is ready`,
  };
}
