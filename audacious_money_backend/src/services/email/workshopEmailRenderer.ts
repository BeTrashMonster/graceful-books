/**
 * Workshop Email HTML Rendering Service
 *
 * Converts admin's custom email templates with template tags into properly formatted,
 * email-client-compatible HTML. Handles template tag replacement, HTML sanitization,
 * email-safe styling, and plain text generation.
 */

import type { Workshop, WorkshopEnrollment, EmailTemplate } from '../../types/workshop.types.js';
import type { EmailType } from './workshopEmails.js';
import { getDefaultEmailTemplate, replaceTemplateTags } from './workshopEmails.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Rendered email ready to send
 */
interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
  preheader: string;
}

/**
 * User data for template tag replacement
 */
interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  selectedCharityName?: string;
}

// =============================================================================
// MAIN RENDERING FUNCTION
// =============================================================================

/**
 * Render email template with user data
 *
 * @param workshop - Workshop configuration
 * @param enrollment - User's enrollment record
 * @param user - User data for personalization
 * @param emailType - Type of email to render
 * @returns Rendered email with HTML, text, subject, and preheader
 */
async function renderEmailTemplate(
  workshop: Workshop,
  enrollment: WorkshopEnrollment,
  user: UserData,
  emailType: EmailType
): Promise<RenderedEmail> {
  // Get custom template or fall back to default
  const template = getTemplateForType(workshop, emailType);

  // Build template variables
  const variables = buildTemplateVariables(workshop, user);

  // Replace template tags in subject, preheader, and body
  const renderedSubject = replaceTemplateTags(template.subject, variables);
  const renderedPreheader = replaceTemplateTags(template.preheader || '', variables);
  const renderedBody = replaceTemplateTags(template.body, variables);

  // Sanitize HTML (remove dangerous tags/attributes)
  const sanitizedBody = sanitizeEmailHtml(renderedBody);

  // Wrap body in responsive email layout
  const html = wrapInEmailLayout(sanitizedBody, workshop, renderedPreheader);

  // Generate plain text version
  const text = htmlToPlainText(sanitizedBody);

  return {
    html,
    text,
    subject: renderedSubject,
    preheader: renderedPreheader,
  };
}

// =============================================================================
// TEMPLATE SELECTION
// =============================================================================

/**
 * Get email template (custom or default) for specific email type
 *
 * @param workshop - Workshop configuration
 * @param emailType - Type of email
 * @returns Email template object with body field
 */
function getTemplateForType(
  workshop: Workshop,
  emailType: EmailType
): { subject: string; preheader: string; body: string } {
  // Check if workshop has custom template for this type
  const customTemplates = workshop.customEmailTemplates;
  const customTemplate = customTemplates?.[emailType === 'wrapup' ? 'wrapUp' : emailType];

  if (customTemplate && customTemplate.htmlBody) {
    // Use custom template
    return {
      subject: customTemplate.subject,
      preheader: customTemplate.preheader || '',
      body: customTemplate.htmlBody,
    };
  }

  // Fall back to default template
  const defaultTemplate = getDefaultEmailTemplate(emailType);
  return {
    subject: defaultTemplate.subject,
    preheader: defaultTemplate.preheader,
    body: defaultTemplate.body,
  };
}

// =============================================================================
// TEMPLATE VARIABLE BUILDING
// =============================================================================

/**
 * Build all template variables for tag replacement
 *
 * @param workshop - Workshop configuration
 * @param user - User data
 * @returns Object with all template variables
 */
function buildTemplateVariables(workshop: Workshop, user: UserData): Record<string, string> {
  const appUrl = process.env.FRONTEND_URL || 'https://app.audacious.money';

  return {
    firstName: user.firstName || 'there',
    fullName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || 'there',
    workshopName: workshop.cohortName,
    workshopDate: formatDate(workshop.workshopStartDatetime),
    workshopTime: formatTime(workshop.workshopStartDatetime, workshop.primaryTimezone, workshop.secondaryTimezone),
    workshopLocation: workshop.location || 'TBD',
    accessGrantDate: formatDate(workshop.accessGrantDatetime),
    trialStartDate: formatDate(workshop.trialStartDatetime),
    trialDurationDays: workshop.trialDurationDays.toString(),
    charityName: user.selectedCharityName || 'your chosen charity',
    loginUrl: `${appUrl}/login`,
  };
}

// =============================================================================
// DATE/TIME FORMATTING
// =============================================================================

/**
 * Format date in friendly format
 *
 * @param date - Date to format
 * @returns Formatted date string (e.g., "Monday, June 8, 2026")
 */
function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time with timezone(s)
 *
 * @param datetime - Date/time to format
 * @param primaryTz - Primary timezone (IANA format)
 * @param secondaryTz - Optional secondary timezone
 * @returns Formatted time string with timezone(s)
 */
function formatTime(datetime: Date, primaryTz: string, secondaryTz?: string): string {
  const d = new Date(datetime);

  const primaryTime = d.toLocaleTimeString('en-US', {
    timeZone: primaryTz,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  if (secondaryTz) {
    const secondaryTime = d.toLocaleTimeString('en-US', {
      timeZone: secondaryTz,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    return `${primaryTime} / ${secondaryTime}`;
  }

  return primaryTime;
}

// =============================================================================
// HTML SANITIZATION
// =============================================================================

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * Removes dangerous tags and attributes while preserving safe formatting.
 * Email-safe subset of HTML: p, br, strong, em, u, a, h1-h3, ul, ol, li, blockquote
 *
 * @param html - HTML to sanitize
 * @returns Sanitized HTML
 */
function sanitizeEmailHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol in links
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

  // Remove style attributes (we use inline styles in layout wrapper)
  // Keep basic formatting but remove potentially dangerous styles
  sanitized = sanitized.replace(/style\s*=\s*["'][^"']*["']/gi, '');

  // Remove data attributes
  sanitized = sanitized.replace(/data-\w+\s*=\s*["'][^"']*["']/gi, '');

  return sanitized;
}

// =============================================================================
// EMAIL LAYOUT WRAPPER
// =============================================================================

/**
 * Wrap content in responsive email layout
 *
 * @param bodyHtml - Sanitized body HTML
 * @param workshop - Workshop configuration
 * @param preheader - Preheader text
 * @returns Complete HTML email
 */
function wrapInEmailLayout(bodyHtml: string, workshop: Workshop, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(workshop.cohortName)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #333333; background-color: #f4f4f4;">
  <!-- Preheader text (hidden but shows in email preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    ${escapeHtml(preheader)}
  </div>

  <!-- Email container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <!-- Content wrapper -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px;">
              <!-- Body content -->
              <div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #333333;">
                ${bodyHtml}
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="max-width: 600px; margin: 20px auto 0;">
          <tr>
            <td style="padding: 20px; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0 0 10px 0;">
                Audacious Money<br>
                Building financial confidence, one step at a time.
              </p>
              <p style="margin: 0;">
                <a href="https://audacious.money" style="color: #4b006e; text-decoration: none;">audacious.money</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// =============================================================================
// PLAIN TEXT GENERATION
// =============================================================================

/**
 * Convert HTML to plain text
 *
 * Simple HTML-to-text conversion for email clients that don't support HTML.
 * Preserves basic formatting like line breaks and lists.
 *
 * @param html - HTML to convert
 * @returns Plain text version
 */
function htmlToPlainText(html: string): string {
  let text = html;

  // Convert headers to uppercase with spacing
  text = text.replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, '\n\n$1\n');

  // Convert paragraphs to double line breaks
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

  // Convert <br> to line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Convert list items
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');

  // Convert blockquotes to indented text
  text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive line breaks
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces to single space
  text = text.trim();

  return text;
}

// =============================================================================
// HTML ESCAPING
// =============================================================================

/**
 * Escape HTML special characters
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { renderEmailTemplate };
export type { RenderedEmail, UserData };
