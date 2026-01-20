/**
 * IC4: Email Template Utilities
 *
 * Helper functions for email template rendering with XSS prevention
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Escapes special characters in user input
 */
export function sanitizeHtml(input: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return input.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Sanitize plain text (remove HTML tags)
 */
export function sanitizePlainText(input: string): string {
  // Remove HTML tags
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Replace template variables with sanitized values
 * Variables are in {{variableName}} format
 */
export function replaceVariables(
  template: string,
  variables: Record<string, string>,
  isHtml: boolean = true
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const sanitizedValue = isHtml ? sanitizeHtml(value) : sanitizePlainText(value);
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, sanitizedValue);
  }

  return result;
}

/**
 * Convert HTML to plain text
 * - Remove HTML tags
 * - Convert <br> to newlines
 * - Convert <p> to newlines
 * - Preserve links as [text](url)
 */
export function htmlToPlainText(html: string): string {
  let text = html;

  // Convert links to [text](url) format
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)');

  // Convert <br> and <br/> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Convert </p> to double newlines
  text = text.replace(/<\/p>/gi, '\n\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Generate unsubscribe URL
 */
export function getUnsubscribeUrl(userId: string, token: string): string {
  const baseUrl = import.meta.env.VITE_APP_URL || 'https://app.gracefulbooks.com';
  return `${baseUrl}/unsubscribe?userId=${userId}&token=${token}`;
}

/**
 * Generate preferences URL
 */
export function getPreferencesUrl(): string {
  const baseUrl = import.meta.env.VITE_APP_URL || 'https://app.gracefulbooks.com';
  return `${baseUrl}/settings/notifications`;
}

/**
 * Validate all required variables are present
 */
export function validateVariables(
  variables: Record<string, string>,
  required: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const key of required) {
    if (!(key in variables) || !variables[key]) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Email header HTML (logo and branding)
 */
export function getEmailHeader(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f7fa; padding: 20px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <tr>
              <td align="center" style="padding: 30px 40px; background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);">
                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600;">
                  Graceful Books
                </h1>
              </td>
            </tr>
  `;
}

/**
 * Email footer HTML (links and support info)
 */
export function getEmailFooter(includeUnsubscribe: boolean = true): string {
  const preferencesUrl = getPreferencesUrl();

  return `
            <tr>
              <td style="padding: 30px 40px; background-color: #f5f7fa; border-top: 1px solid #e1e8ed;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding-bottom: 15px;">
                      <a href="https://gracefulbooks.com/help" style="color: #4A90E2; text-decoration: none; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0 10px;">Help Center</a>
                      <span style="color: #8899a6; margin: 0 5px;">|</span>
                      <a href="https://gracefulbooks.com/contact" style="color: #4A90E2; text-decoration: none; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0 10px;">Contact Support</a>
                      <span style="color: #8899a6; margin: 0 5px;">|</span>
                      <a href="https://gracefulbooks.com/privacy" style="color: #4A90E2; text-decoration: none; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0 10px;">Privacy Policy</a>
                    </td>
                  </tr>
                  ${
                    includeUnsubscribe
                      ? `
                  <tr>
                    <td align="center" style="padding-top: 10px;">
                      <a href="${preferencesUrl}" style="color: #657786; text-decoration: none; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        Update email preferences
                      </a>
                    </td>
                  </tr>
                  `
                      : ''
                  }
                  <tr>
                    <td align="center" style="padding-top: 15px;">
                      <p style="margin: 0; color: #657786; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
                        © ${new Date().getFullYear()} Graceful Books. All rights reserved.<br>
                        Accounting software that feels like a friend, not a chore.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Create a styled button for email CTAs
 */
export function createButton(label: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
      <tr>
        <td align="center" style="border-radius: 6px; background-color: #4A90E2;">
          <a href="${sanitizeHtml(url)}" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; min-width: 200px; text-align: center;">
            ${sanitizeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Email body wrapper (content section)
 */
export function wrapEmailBody(content: string): string {
  return `
            <tr>
              <td style="padding: 40px 40px 20px 40px;">
                ${content}
              </td>
            </tr>
  `;
}
